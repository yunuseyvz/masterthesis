#!/usr/bin/env node
// Benchmarks Jev (System One) on the study corpus: for every story x variant x step, ask typed questions
// about the agent step and record answers + latency as JSON lines.
//
//   OPENCODE_API_KEY=... node scripts/evaluate-jev.mjs <out.jsonl> [--repeats 2] [--model jev-1.13-free]
//
// The key is read from the environment only; nothing here stores it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpus = path.join(root, "server/corpus");
const args = process.argv.slice(2);
const out = args[0];
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const REPEATS = Number(opt("--repeats", 2));
const MODEL = opt("--model", "jev-1.13-free");
const QSET = opt("--qset", "v2"); // v1 = first wording (M3 mentions wrong versions); v2 = no defect reasoning
const CONC = Number(opt("--concurrency", 4));
const URL = "https://opencode.ai/inference/systemone/v1/systemone";
const KEY = process.env.OPENCODE_API_KEY;
if (!out || !KEY) {
  console.error("usage: OPENCODE_API_KEY=... node scripts/evaluate-jev.mjs <out.jsonl>");
  process.exit(1);
}

const STORIES = ["US1", "US2", "US3", "US4", "US5", "US6"];
const VARIANTS = ["Correct", "Flawed"];

const pick = (src, v) => (typeof src === "string" ? src : src[v]);
function load(id) {
  const dir = path.join(corpus, id);
  const def = JSON.parse(fs.readFileSync(path.join(dir, "story.json"), "utf8"));
  return { dir, def };
}
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
const fence = (p, c) => `--- ${p}\n${c.trimEnd()}\n`;

/** State a live reviewer would have after agent step n. No step kind, no variant, no ground truth. */
function buildState({ dir, def }, variant, n, cond) {
  const step = def.steps[n - 1];
  const parts = [`USER STORY:\n${def.brief}`, `AGENT STEP ${n} of 4: ${step.summary}`];
  parts.push("FILES WRITTEN IN THIS STEP:\n" + step.files.map((f) => fence(f.path, read(dir, pick(f.source, variant)))).join("\n"));
  if (cond === "ctx") {
    const earlier = def.steps.slice(0, n - 1).flatMap((s) => s.files.filter((f) => f.path !== def.testFile));
    if (earlier.length) parts.push("EARLIER FILES IN THE REPOSITORY:\n" + earlier.map((f) => fence(f.path, read(dir, pick(f.source, variant)))).join("\n"));
    if (n >= def.testsAvailableFromStep) {
      const t = def.steps.flatMap((s) => s.files).find((f) => f.path === def.testFile);
      if (t && !step.files.some((f) => f.path === def.testFile)) parts.push("EXISTING TESTS (all passing):\n" + fence(t.path, read(dir, pick(t.source, variant))));
    }
  }
  return parts.join("\n\n");
}

// Operational wording, derived from the criteria and not from the seeded defects.
const QUESTIONS = {
  is_scaffolding_step: {
    type: "noul",
    instructions:
      "Does this step only declare types or imports, or only forward calls to existing code, without adding any new conditional, arithmetic, or state change on domain data?",
  },
  m1_unspecified_case: {
    type: "noul",
    instructions:
      "Does the new code decide the outcome for an input class (such as a failure, empty, or boundary case) that the user story does not specify, where more than one reasonable outcome exists?",
  },
  m2_foundation: {
    type: "noul",
    instructions:
      "Does this step define a unit that owns state or an invariant and that other parts of the system would then build on?",
  },
  m3_test_blind_spot: {
    type: "noul",
    instructions:
      "Is there an input case the story implies that the visible tests do not cover, such that a plausible wrong version of this code would still pass the tests?",
  },
  checkpoint_classification: {
    type: "choice",
    instructions: "Which description fits this agent step best?",
    criteria: {
      scaffolding: "Types, imports, or plumbing that forwards to existing code; no new behavioural decisions",
      tests_only: "Only adds or changes tests",
      m1_unspecified_case: "Core code that decides behaviour for a case the user story leaves unspecified",
      m2_foundation: "Core state or invariant logic that later code will build on",
      m3_test_blind_spot: "Code whose edge-case behaviour the visible tests do not pin down",
    },
  },
  intervention_urgency: {
    type: "score",
    instructions: "How important is it to pause the coding agent and have the human check this step before the agent continues?",
    criteria: ["Do not pause: routine", "Low: routine wiring", "Moderate: reviewable logic", "Critical: pause now"],
  },
};

// v2: every question is about the shape of the step and its tests, never about whether the code is right.
const QUESTIONS_V2 = {
  ...QUESTIONS,
  m3_test_blind_spot: {
    type: "noul",
    instructions:
      "Does the code branch on or compute over several distinct input cases, while the visible tests exercise only some of those cases?",
  },
  pause_point: {
    type: "noul",
    instructions:
      "Does this step complete a self-contained piece of behaviour that the next steps will build on, so that a reviewer could check it on its own before the agent continues?",
  },
  checkpoint_classification: {
    ...QUESTIONS.checkpoint_classification,
    criteria: {
      ...QUESTIONS.checkpoint_classification.criteria,
      m3_test_blind_spot: "Code with several input cases where the visible tests exercise only some of them",
    },
  },
};
const ACTIVE = QSET === "v1" ? QUESTIONS : QUESTIONS_V2;

async function ask(state) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const t0 = performance.now();
    const res = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, state, questions: ACTIVE }),
    });
    const ms = performance.now() - t0;
    if (res.status === 429 && Number(res.headers.get("retry-after") ?? 0) > 120) {
      return { status: 429, ms, body: null, retryAfter: Number(res.headers.get("retry-after")) }; // quota exhausted: stop, don't hammer
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    const body = await res.json();
    return { status: res.status, ms, body };
  }
  return { status: 0, ms: 0, body: null };
}

const jobs = [];
for (const id of STORIES) {
  const s = load(id);
  for (const variant of VARIANTS)
    for (const n of [1, 2, 3, 4])
      for (const cond of ["step", "ctx"])
        for (let rep = 0; rep < REPEATS; rep++) jobs.push({ id, variant, n, cond, rep, kind: s.def.steps[n - 1].kind, state: buildState(s, variant, n, cond) });
}

// --resume keeps successful rows already in <out> and only runs the missing jobs.
const keyOf = (j) => [j.id, j.variant, j.n, j.cond, j.rep].join("|");
let kept = new Set();
if (args.includes("--resume") && fs.existsSync(out)) {
  const rows = fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const good = rows.filter((r) => r.status === 200);
  kept = new Set(good.map(keyOf));
  fs.writeFileSync(out, good.map((r) => JSON.stringify(r) + "\n").join(""));
} else fs.writeFileSync(out, "");
let done = 0;
let halted = false;
const queue = jobs.filter((j) => !kept.has(keyOf(j)));
async function worker() {
  while (queue.length && !halted) {
    const j = queue.shift();
    const r = await ask(j.state);
    if (r.retryAfter) {
      halted = true;
      console.error(`rate limit exhausted, retry in ~${Math.round(r.retryAfter / 3600)}h; rerun with --resume`);
      break;
    }
    const { state, ...meta } = j;
    fs.appendFileSync(out, JSON.stringify({ ...meta, stateChars: state.length, ...r }) + "\n");
    if (++done % 20 === 0) console.error(`${done}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.error(`done: ${jobs.length} requests -> ${out}`);
