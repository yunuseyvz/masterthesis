#!/usr/bin/env node
// Runs the v3 question set (scripts/jev-questions.mjs) on steps of unscripted agent traces (docs/jev-benchmark/extract_traces.py output).
//   OPENROUTER_API_KEY=... node scripts/evaluate-jev-traces.mjs <traces.json> <out.jsonl> [--model jev-latest] [--repeats 2] [--budget 0.1]
import fs from "node:fs";
import { QUESTIONS } from "./jev-questions.mjs";

const args = process.argv.slice(2);
const [inFile, out] = args;
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const MODEL = opt("--model", "jev-latest");
const REPEATS = Number(opt("--repeats", 2));
const BUDGET = Number(opt("--budget", 0.1));
const CONC = 4;
const URL = process.env.JEV_URL ?? "https://openrouter.ai/api/v1/systemone";
const KEY = process.env.OPENROUTER_API_KEY;
if (!inFile || !out || !KEY) { console.error("usage: OPENROUTER_API_KEY=... node scripts/evaluate-jev-traces.mjs <traces.json> <out.jsonl>"); process.exit(1); }

const traces = JSON.parse(fs.readFileSync(inFile, "utf8"));
const jobs = [];
for (const t of traces)
  for (const s of t.steps)
    for (const cond of ["step", "tests"])
      for (let rep = 0; rep < REPEATS; rep++) {
        const state = { user_story: t.brief, agent_step: { number: s.n, summary: s.summary, files: s.files } };
        if (cond === "tests" && s.visible_tests.length) state.visible_tests = s.visible_tests;
        jobs.push({ trace: t.trace, story: t.story, n: s.n, nSteps: t.n_steps, cond, rep, L1: s.L1, state });
      }

let spent = 0, halted = false, done = 0;
fs.writeFileSync(out, "");
async function ask(state) {
  for (let a = 0; a < 5; a++) {
    const t0 = performance.now();
    let res;
    try { res = await fetch(URL, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, state, questions: QUESTIONS }) }); }
    catch { await new Promise((r) => setTimeout(r, 1000 * 2 ** a)); continue; }
    const ms = performance.now() - t0;
    if (res.status === 429 && Number(res.headers.get("retry-after") ?? 0) > 120) return { status: 429, ms, body: null, retryAfter: 1 };
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1000 * 2 ** a)); continue; }
    const body = await res.json();
    spent += body?.usage?.cost ?? 0;
    return { status: res.status, ms, body };
  }
  return { status: 0, ms: 0, body: null };
}
const queue = [...jobs];
async function worker() {
  while (queue.length && !halted) {
    if (spent > BUDGET) { halted = true; console.error(`budget reached ($${spent.toFixed(4)})`); break; }
    const j = queue.shift();
    const r = await ask(j.state);
    if (r.retryAfter) { halted = true; console.error("rate limited"); break; }
    const { state, ...meta } = j;
    fs.appendFileSync(out, JSON.stringify({ ...meta, stateChars: JSON.stringify(state).length, ...r }) + "\n");
    if (++done % 20 === 0) console.error(`${done}/${jobs.length} $${spent.toFixed(4)}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.error(`finished ${done}/${jobs.length}, spent $${spent.toFixed(4)}`);
