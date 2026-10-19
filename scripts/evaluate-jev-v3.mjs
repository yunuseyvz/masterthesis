#!/usr/bin/env node
// Jev benchmark v3: follows TypeSafe's guidance (structured state, one atomic yes/no per condition with criteria,
// composition in code, choice order checked, pinned model version recorded).
// Every question concerns the SHAPE of the agent step and its tests. None asks whether the code is correct.
//
//   OPENROUTER_API_KEY=... node scripts/evaluate-jev-v3.mjs <out.jsonl> [--models jev-1.13,jev-1.14] [--repeats 2] [--budget 0.15]
//
// Use --resume to keep successful rows already in <out> and only run what is missing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpus = path.join(root, "server/corpus");
const args = process.argv.slice(2);
const out = args[0];
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const MODELS = opt("--models", "jev-1.13,jev-1.14").split(",");
const REPEATS = Number(opt("--repeats", 2));
const CONC = Number(opt("--concurrency", 4));
const BUDGET = Number(opt("--budget", 0.15)); // USD; stop early beyond this
const URL = process.env.JEV_URL ?? "https://openrouter.ai/api/v1/systemone";
const KEY = process.env.OPENROUTER_API_KEY;
if (!out || !KEY) {
  console.error("usage: OPENROUTER_API_KEY=... node scripts/evaluate-jev-v3.mjs <out.jsonl>");
  process.exit(1);
}

const STORIES = ["US1", "US2", "US3", "US4", "US5", "US6"];
const VARIANTS = ["Correct", "Flawed"];
const pick = (src, v) => (typeof src === "string" ? src : src[v]);
const load = (id) => {
  const dir = path.join(corpus, id);
  return { dir, def: JSON.parse(fs.readFileSync(path.join(dir, "story.json"), "utf8")) };
};
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8").trimEnd();

/** What a live reviewer sees after agent step n. No step kind, variant, story id or step count. */
function buildState({ dir, def }, variant, n, cond) {
  const step = def.steps[n - 1];
  const state = {
    user_story: def.brief,
    agent_step: {
      number: n,
      summary: step.summary,
      files: step.files.map((f) => ({ path: f.path, content: read(dir, pick(f.source, variant)) })),
    },
  };
  if (cond === "tests" && n >= def.testsAvailableFromStep) {
    const t = def.steps.flatMap((s) => s.files).find((f) => f.path === def.testFile);
    if (t && !step.files.some((f) => f.path === def.testFile)) state.visible_tests = [{ path: t.path, content: read(dir, pick(t.source, variant)) }];
  }
  return state;
}

const yn = (instructions, trueDesc, falseDesc) => ({ type: "noul", instructions, criteria: { true: trueDesc, false: falseDesc } });

const FILES = "`agent_step.files`";
const QUESTIONS = {
  // Step shape
  s_logic: yn(
    `Does any function in ${FILES} contain a conditional (if, switch, ternary, loop, or catch) that chooses between different outcomes?`,
    "At least one function chooses between outcomes with a conditional",
    "No function contains such a conditional; the code only declares types or forwards values",
  ),
  s_state: yn(
    `Does any function in ${FILES} change stored data that outlives the function call?`,
    "A function assigns to or mutates data that persists after it returns",
    "No function changes persistent data",
  ),
  s_tests_only: yn(`Do the files in ${FILES} consist only of test code?`, "Only test code", "At least one file is not test code"),
  // M1: three atomic conditions, combined in code
  m1_special_inputs: yn(
    `Does any function in ${FILES} treat a failure, empty, or boundary input differently from normal input?`,
    "A function has separate handling for a failure, empty, or boundary input",
    "No separate handling for such inputs",
  ),
  m1_story_silent: yn(
    "Does `user_story` leave unspecified what should happen for the failure, empty, or boundary inputs that the code in `agent_step.files` handles?",
    "The story does not say what should happen for those inputs",
    "The story states what should happen for those inputs",
  ),
  m1_plural_outcomes: yn(
    "Given `user_story`, is more than one outcome reasonable for the failure, empty, or boundary inputs that the code in `agent_step.files` handles?",
    "At least two different outcomes would be reasonable",
    "Only one outcome is reasonable",
  ),
  // M2
  m2_owns_state: yn(
    `Does any function in ${FILES} keep or enforce data or a rule that other code would need to respect?`,
    "The code keeps data or enforces a rule that other code relies on",
    "The code keeps no data and enforces no rule",
  ),
  m2_exported: yn(
    `Does ${FILES} export a function that other modules would need to call to deliver \`user_story\`?`,
    "An exported function is needed by other modules to deliver the story",
    "Nothing exported here is needed by other modules",
  ),
  m2_self_contained: yn(
    `Could the behaviour in ${FILES} be checked on its own, before any other file for \`user_story\` is written?`,
    "The behaviour can be checked without any other new file",
    "The behaviour cannot be checked without other new files",
  ),
  // M3 (needs visible_tests; false when absent)
  m3_input_kinds: yn(
    `Does the code in ${FILES} distinguish several kinds of input, each leading to a different result?`,
    "The code distinguishes at least three kinds of input with different results",
    "The code treats all inputs alike or distinguishes only two kinds",
  ),
  m3_tests_fewer: yn(
    "Do the tests in `visible_tests` exercise fewer kinds of input than the code in `agent_step.files` distinguishes? If `visible_tests` is missing, answer no.",
    "The tests cover fewer kinds of input than the code distinguishes",
    "The tests cover every kind of input the code distinguishes, or there are no tests",
  ),
  // Holistic references (kept for comparison with the composites)
  pause_point: yn(
    "Does this step complete one self-contained piece of behaviour that later steps will build on?",
    "The step completes a piece of behaviour that later work depends on",
    "The step does not complete such a piece",
  ),
  intervention_urgency: {
    type: "score",
    instructions: "How important is it to pause the coding agent so a human can check this step before the agent continues?",
    criteria: ["Do not pause: routine", "Low: routine wiring", "Moderate: reviewable logic", "Critical: pause now"],
  },
};
// Choice asked twice with the option order reversed, to check order sensitivity.
const OPTS = [
  ["scaffolding", "Types, imports, or plumbing with no new behavioural decisions"],
  ["tests_only", "Only adds or changes tests"],
  ["behaviour_decision", "Core code that decides behaviour for inputs the user story leaves unspecified"],
  ["core_state_logic", "Core code that keeps data or enforces a rule that later code relies on"],
  ["many_input_cases", "Code that distinguishes many kinds of input"],
];
const choiceQ = (opts) => ({ type: "choice", instructions: "Which description fits this agent step best?", criteria: Object.fromEntries(opts) });
QUESTIONS.cls_a = choiceQ(OPTS);
QUESTIONS.cls_b = choiceQ([...OPTS].reverse());

let spent = 0;
let halted = false;
async function ask(model, state) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const t0 = performance.now();
    let res;
    try {
      res = await fetch(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, state, questions: QUESTIONS }),
      });
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    const ms = performance.now() - t0;
    if (res.status === 429 && Number(res.headers.get("retry-after") ?? 0) > 120) return { status: 429, ms, body: null, retryAfter: Number(res.headers.get("retry-after")) };
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    const body = await res.json();
    spent += body?.usage?.cost ?? 0;
    return { status: res.status, ms, body };
  }
  return { status: 0, ms: 0, body: null };
}

const jobs = [];
for (const model of MODELS)
  for (const id of STORIES) {
    const s = load(id);
    for (const variant of VARIANTS)
      for (const n of [1, 2, 3, 4])
        for (const cond of ["step", "tests"])
          for (let rep = 0; rep < REPEATS; rep++)
            jobs.push({ model, id, variant, n, cond, rep, kind: s.def.steps[n - 1].kind, state: buildState(s, variant, n, cond) });
  }

const keyOf = (j) => [j.model, j.id, j.variant, j.n, j.cond, j.rep].join("|");
let kept = new Set();
if (args.includes("--resume") && fs.existsSync(out)) {
  const good = fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.status === 200);
  kept = new Set(good.map(keyOf));
  fs.writeFileSync(out, good.map((r) => JSON.stringify(r) + "\n").join(""));
} else fs.writeFileSync(out, "");
const queue = jobs.filter((j) => !kept.has(keyOf(j)));
let done = 0;
async function worker() {
  while (queue.length && !halted) {
    if (spent > BUDGET) {
      halted = true;
      console.error(`budget $${BUDGET} reached (spent $${spent.toFixed(4)}); rerun with --resume and a higher --budget`);
      break;
    }
    const j = queue.shift();
    const r = await ask(j.model, j.state);
    if (r.retryAfter) {
      halted = true;
      console.error(`rate limited, retry-after ${r.retryAfter}s; rerun with --resume`);
      break;
    }
    const { state, ...meta } = j;
    fs.appendFileSync(out, JSON.stringify({ ...meta, stateChars: JSON.stringify(state).length, ...r }) + "\n");
    if (++done % 25 === 0) console.error(`${done}/${queue.length + done}  spent $${spent.toFixed(4)}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.error(`finished ${done} requests, spent $${spent.toFixed(4)} -> ${out}`);
