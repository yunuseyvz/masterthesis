# Jev as a pause-point decider: benchmark write-up

> **Naming (19 October 2026).** The criteria were renamed from M1/M2/M3 to C1/C2/C3. The scripts, question ids (`m1_…`, `m2_…`, `m3_…`) and the result files keep the original names, because they were produced under them.
>
> **Corpus layout (19 October 2026).** The results below were produced when the milestone was always Step 2 of every story. The corpus has since been restructured (milestone at step 1, 2 or 3), so the scripts now read a different layout and the step-number rule no longer solves it. The result files are unchanged.

**Date:** 18 October 2026 · **Status:** exploratory, scripted corpus only · **Models:** `jev-1.13-20260917`, `jev-1.14-20261014`

## 1. Purpose

The study pauses a coding agent at the step where a human check is worth it (the "intervention point", Step 2 of each story) and not at scaffolding steps. This benchmark asks one narrow question:

> Given what a live reviewer would see after an agent step, can Jev (a System One model) tell whether that step is the point to pause?

Jev is **not** used to judge whether the code is correct. No question mentions defects, bugs, or wrong versions, and the Flawed/Correct variants are used only to check that Jev's answer does not change with correctness.

## 2. Data

Source: the study corpus in `server/corpus/US1`–`US6` (6 stories × 4 agent steps × 2 variants Correct/Flawed).

| Step | Kind (label) | Content |
|---|---|---|
| 1 | scaffold | types |
| 2 | **milestone** (positive) | core domain/state logic |
| 3 | scaffold | handler / wiring (contains real branching, see §7) |
| 4 | completion | tests |

Label: `step.kind == "milestone"` (Step 2) is positive, every other step negative. 6 positives and 18 negatives per variant.

## 3. How requests were built

### Endpoint and model

- `POST https://openrouter.ai/api/v1/systemone` (TypeSafe's System One API as served by OpenRouter; same request and response shape as `api.typesafe.ai/v1/systemone`).
- Header: `Authorization: Bearer <OpenRouter key>` (read from `OPENROUTER_API_KEY`, never stored).
- `model`: `jev-1.13` and `jev-1.14`. OpenRouter resolves these to the dated versions recorded in each response's `model` field (`typesafe/jev-1.13-20260917`, `typesafe/jev-1.14-20261014`).
- The only request fields used are `model`, `state` and `questions`; the docs I read list no sampling parameters. No long-context header was used (requests are about 1.8k input tokens including the questions).

### State (a structured object, as TypeSafe recommends)

What a live reviewer would have after step *n*. Nothing about step kind, variant, story ID or total number of steps is included.

```json
{
  "user_story": "As a customer during a flash sale, I want to reserve stock ...",
  "agent_step": {
    "number": 2,
    "summary": "Implement stock reservation",
    "files": [{ "path": "src/inventory.ts", "content": "<full file>" }]
  },
  "visible_tests": [{ "path": "test/inventory.test.ts", "content": "<full file>" }]
}
```

Two conditions:

| Condition | State |
|---|---|
| `step` | `user_story` + `agent_step` |
| `tests` | `step` plus `visible_tests` from Step 2 onward (the corpus treats the suite as part of the repo once the code exists) |

Earlier files were deliberately left out: TypeSafe's Jev 1.13 notes warn that irrelevant context lowers accuracy.

### Questions (15 per request, one HTTP call)

All questions go in a single request and are evaluated independently. Yes/no (`noul`) questions each carry `criteria.true` and `criteria.false`, each asks one thing, and refers to state fields by name. Wording is in `scripts/evaluate-jev-v3.mjs` (`QUESTIONS`). Summary:

| ID | Type | Asks (abbreviated) |
|---|---|---|
| `s_logic` | noul | Does any function in `agent_step.files` contain a conditional that chooses between outcomes? |
| `s_state` | noul | Does any function change stored data that outlives the call? |
| `s_tests_only` | noul | Are the files only test code? |
| `m1_special_inputs` | noul | Is a failure/empty/boundary input handled differently from normal input? |
| `m1_story_silent` | noul | Does `user_story` leave that handling unspecified? |
| `m1_plural_outcomes` | noul | Given `user_story`, is more than one outcome reasonable for those inputs? |
| `m2_owns_state` | noul | Does the code keep data or enforce a rule that other code must respect? |
| `m2_exported` | noul | Does the step export a function other modules need to deliver the story? |
| `m2_self_contained` | noul | Could the behaviour be checked on its own before any other file is written? |
| `m3_input_kinds` | noul | Does the code distinguish several kinds of input with different results? |
| `m3_tests_fewer` | noul | Do `visible_tests` exercise fewer kinds of input than the code distinguishes? (no tests: answer no) |
| **`pause_point`** | noul | **Does this step complete one self-contained piece of behaviour that later steps will build on?** (true: "the step completes a piece of behaviour that later work depends on"; false: "the step does not complete such a piece") |
| `intervention_urgency` | score, 4 levels | How important is it to pause the agent so a human can check this step? Levels: Do not pause: routine / Low: routine wiring / Moderate: reviewable logic / Critical: pause now |
| `cls_a`, `cls_b` | choice (5 options) | Which description fits best? Same options, reversed order in `cls_b`, to test order sensitivity. |

### Composition in code (fixed before looking at results)

```
C1 = min(m1_special_inputs, m1_story_silent, m1_plural_outcomes)
C2 = min(m2_owns_state, m2_exported, m2_self_contained)
C3 = min(m3_input_kinds, m3_tests_fewer)
PRIMARY = max(C1, C2, C3)
```

`pause_point`, `intervention_urgency` (score ÷ 3) and `C2` alone are secondary or exploratory. They were not designated primary in advance.

### Run design

6 stories × 2 variants × 4 steps × 2 conditions × 2 repeats × 2 models = **384 requests**, concurrency 4, retries on 429/5xx. 0 failures. Total cost **$0.029** ($0.00007–0.00008 per request, 14 questions each).

## 4. Metrics

- **AUROC** of each score for Step 2 vs. all other steps, pooled over stories and variants. 95% intervals by bootstrap resampling the 6 stories (the real independent unit; variants and repeats are not independent).
- **Within-story top-1:** is Step 2 the highest-scoring step in each story-variant (12 cases)?
- **Variant invariance:** mean (Flawed − Correct) of the score at Step 2. Should be about 0 for a pause-point decider.
- **Option-order stability** of the choice question; **repeat consistency** (same request twice); **model agreement** (1.13 vs 1.14 on identical states); latency and cost.

## 5. Results

### AUROC, Step 2 vs. other steps (pooled over 6 stories × 2 variants × 2 repeats)

| Score | 1.13 `step` | 1.13 `tests` | 1.14 `step` | 1.14 `tests` |
|---|---|---|---|---|
| `pause_point` | 0.97 [0.91, 1.00] | **1.00** [1.00, 1.00] | 0.91 [0.81, 0.98] | **1.00** [0.99, 1.00] |
| C2 composite | 0.95 [0.84, 1.00] | **1.00** [0.99, 1.00] | 0.96 [0.86, 1.00] | **1.00** [1.00, 1.00] |
| `intervention_urgency` | 0.81 [0.73, 0.88] | 0.76 [0.65, 0.86] | 0.84 [0.77, 0.92] | 0.81 [0.70, 0.91] |
| PRIMARY (pre-declared) | 0.77 [0.63, 0.92] | 0.84 [0.70, 0.95] | 0.73 [0.55, 0.89] | 0.80 [0.66, 0.92] |
| C1 composite | 0.71 | 0.71 | 0.69 | 0.67 |
| C3 composite | 0.51 | 0.75 | 0.42 | 0.76 |
| "substantive" (`max(s_logic, s_state)`) | 0.70 | 0.70 | 0.72 | 0.70 |
| Regex baseline (control-flow/arithmetic token count) | 0.82 | | | |
| Position prior (step number = 2) | 1.00 by construction | | | |

Mean `pause_point` by step (tests condition): 1.13 → 0.58 / **0.86** / 0.73 / 0.24; 1.14 → 0.58 / **0.83** / 0.73 / 0.32 (steps 1–4).

### Within-story ranking and thresholds

Step 2 is the highest-scoring step on `pause_point` in **12/12** story-variants with tests visible (both models), and in 11/12 (1.13) and 8/12 (1.14) without tests. The absolute margin is small: pooled over all stories, the lowest Step-2 score and the highest score of any other step are 0.81 vs 0.79 (1.13) and 0.77 vs 0.78 (1.14). A fixed threshold near 0.80 would work on this data, but it was not tuned on held-out data and the margin is thin.

### Other checks

| Check | Result |
|---|---|
| Variant invariance, PRIMARY at Step 2, Flawed − Correct | −0.025 to +0.001 (per story −0.15 to +0.02) |
| Choice stable under reversed option order | 91–96 of 96 per cell |
| Repeat consistency (PRIMARY, same request twice) | mean absolute difference 0.013–0.016, max 0.07 |
| jev-1.13 vs jev-1.14 on identical states | mean absolute difference 0.048, correlation 0.97 |
| Latency | mean 410–425 ms, median 403–414, p95 447–505 (includes network from WSL) |
| Milestone type by argmax(C1, C2, C3) | 5–10 of 24 (chance 8/24) |
| Choice question at Step 2 | `core_state_logic` in 24/24 for every cell |

## 6. What this supports

- Jev can rank the intended pause step above other steps on this corpus, with high AUROC and 12/12 within-story top-1 when the visible tests are included, on both model versions.
- The answer does not depend on whether the code is correct (invariance ≈ 0), which is the desired behaviour for an intervention-point decider.
- It is fast, cheap and stable enough for a live gate: about 0.4 s, under $0.0001 per step.

## 7. Limitations (read before citing)

1. **Scripted corpus with a fixed layout.** Every story has the same four steps, so step position alone gives AUROC 1.00. This benchmark cannot show Jev beats a positional rule. It needs unscripted agent traces labelled by two raters.
2. **Six independent stories.** Intervals are wide and the effective sample is small. Variants and repeats are not independent.
3. **Metrics chosen after the fact.** The pre-declared composite (PRIMARY) scored 0.73–0.84, no better than the regex baseline (0.82). `pause_point` and C2 were the best of several metrics I computed and are exploratory. Confirm them on data they were not selected from.
4. **`pause_point` is close to the label's own definition.** A high score shows Jev reads that definition correctly on this corpus. It does not independently show that Step 2 is the right place to pause.
5. **Step 3 is not pure scaffolding.** `checkout.ts`-style wiring contains branching and error mapping, so "substantive logic" cannot separate Step 2 from Step 3 (AUROC 0.70). The corpus label "scaffold" for Step 3 is looser than the operational definitions in the thesis. What separates Step 2 from Step 3 here is the state-ownership and "builds on" questions (C2, `pause_point`).
6. **Milestone type (C1/C2/C3) is not recoverable.** Jev rates all milestones as core stateful logic. The corpus M-labels probably describe the seeded defect type, not a property of the step, so a step-level classifier should not be expected to recover them. The study needs only the binary decision.
7. **Causality.** The absolute margin is thin and the within-story result uses all four steps. A live gate decides at Step 2 without seeing Steps 3–4, so it needs a threshold fixed in advance.
8. **Gateway and version.** Results are for the OpenRouter-served dated versions above. Aliases (`jev-latest`) move and should not be used in the study.

## 8. Earlier runs (not the basis of the conclusions)

- **v1 (OpenCode gateway, `jev-1.13-free`, 192 requests, flat-string state, compound questions, fixed option order):** milestone-vs-rest AUROC 0.86–0.88 from the "not scaffolding" answer, 0.79–0.86 from the urgency score, chance-level milestone-type accuracy. Superseded: the setup did not follow TypeSafe's guidance for atomic questions, structured state and criteria.
- **v2:** wording revised to remove defect reasoning. The free quota ran out after a partial run and it was not analysed.

## 9. Reproduce

```bash
# from code/. The key is read from the environment only.
OPENROUTER_API_KEY=... node scripts/evaluate-jev-v3.mjs results.jsonl --repeats 2 --budget 0.15
python3 -I docs/jev-benchmark/analyze_v3.py results.jsonl
```

`--resume` reruns only missing requests. `--models jev-1.13` limits the model set.

## 10. Files

| File | Content |
|---|---|
| `scripts/evaluate-jev-v3.mjs` | request builder and runner |
| `docs/jev-benchmark/analyze_v3.py` | metrics (composites defined at the top) |
| `docs/jev-benchmark/results-v3-2026-10-18.jsonl` | raw responses (384 rows, with served model, latency, token usage, cost) |
| `docs/jev-benchmark/analysis-v3-output.txt` | full analysis output |
| `scripts/evaluate-jev.mjs`, `results-2026-10-18.jsonl`, `analyze.py`, `analysis-output.txt` | v1/v2 runner, data and analysis |

## 11. Sources

TypeSafe documentation (`docs.typesafe.ai`: Introduction, State, Primitives, Noul, Models, "Jev 1.13 jaggedness", "Jev with coding agents") and OpenRouter's TypeSafe SDK guide for the endpoint. Read on 18 October 2026.

## 12. Follow-up: unscripted agent traces (Claude Haiku)

**Why:** the scripted corpus has a fixed layout (§7.1). This follow-up tests Jev on steps nobody scripted. The same 15 questions (`scripts/jev-questions.mjs`, copied verbatim from the v3 script) were asked about each agent step.

**Traces.** Claude Haiku (Claude Code subagent, model alias `haiku`) implemented each of the six tickets twice (12 runs), each in an empty scratch repo containing only `README.md` and `package.json` (no corpus code). It was told to commit after each coherent piece of work. **One commit = one agent step.** Prompt: user story text, "read README.md first", "commit your work with git as you go", otherwise no guidance on structure, steps, wiring or tests. The planned Muse Spark 1.3 was not available (see §13).

| | |
|---|---|
| Traces | 12 (6 stories × 2 runs) |
| Steps | 22 in total: 3 traces have 1 step, 8 have 2, 1 has 3 |
| Model | `jev-latest` → served as `typesafe/jev-1.14-20261014` (all 88 responses) |
| Requests | 22 steps × 2 state conditions (`step`, `tests`) × 2 repeats = 88; $0.0115; mean latency 438 ms; about 3.1k input tokens each |

**State per step:** `{user_story, agent_step: {number, summary = the agent's commit message, files = files changed in that commit with their content}, visible_tests = test files already in the tree}`. Only the `tests` condition includes `visible_tests`.

**Label (mechanical, no judgement).** A step is positive (`L1`) if it adds a non-test source file with logic (conditionals, arithmetic or state changes, by regex) that a non-test file in a **later** commit imports. This is the operational "foundational unit that later code builds on" test (C2). 5 of 22 steps are positive, all of them Step 1 of a multi-step trace (US2 ×2, US4 ×2, US6 run a). It does **not** capture decisions on unspecified cases (C1), and no human second rater has labelled these steps.

### Results

| Score | AUROC `step` | AUROC `tests` |
|---|---|---|
| `pause_point` | 0.80 [0.60, 0.95] | 0.79 [0.58, 0.95] |
| C2 composite | 0.78 [0.61, 0.93] | 0.77 [0.60, 0.94] |
| `intervention_urgency` | 0.63 [0.38, 0.88] | 0.72 [0.45, 0.99] |
| PRIMARY (C1/C2/C3 composite) | 0.52 | 0.53 |
| C1 / C3 | 0.50 / 0.41 | 0.59 / 0.35 |

Baselines against the same label: "first step of a multi-step trace" **0.88**, step number (earlier = higher) 0.79, logic files in step 0.56, lines added 0.36. Intervals are over the 12 traces.

Within-trace ranking (5 traces with a positive step): the `pause_point` top step is the positive step in 5/5, C2 in 4/5, urgency in 1–2 of 5. But the margins are small. Mean `pause_point` is 0.89 for positive steps and 0.80–0.81 for the others. In 2-step traces it is 0.89 vs 0.82 (US2_a), 0.89 vs 0.87 (US2_b), 0.91 vs 0.82 (US4_a), 0.88 vs 0.85 (US6_a). `pause_point` is also 0.88–0.90 for every single-step trace, where nothing is built on later.

What Jev clearly does separate: **tests-only steps score low** (`pause_point` 0.45–0.66 for US5 step 2 and US6 run b step 2). Beyond that, any step that adds new logic scores 0.8–0.9.

### Reading

- Jev did **not** beat a positional baseline here ("first step of a multi-step trace" gets 0.88). The perfect separation on the scripted corpus (§5) does not carry over to these traces.
- The `pause_point` question mostly behaves like "does this step add new behaviour (vs. only tests)". It does not reliably separate "core unit before wiring" from "wiring on top".
- Repeat consistency is good (`pause_point` mean difference 0.009).

### Limits of this follow-up

1. **Tiny and coarse.** 22 steps, 5 positives, only 12 traces. Haiku produced short traces (mostly "module, then tests/wiring"), because the tickets do not ask for an HTTP layer and the agent committed at module granularity.
2. **Single mechanical label.** It misses non-C2 pause points. A human second rater should label every step blind to Jev's scores; a blank sheet is in `labeling-sheet.csv`.
3. **Agent differences.** Haiku is not Muse Spark; a stronger agent may produce more, smaller, and differently shaped steps.
4. **The commit message is the agent's own summary.** It is part of the state, as in the scripted runs.

### 13. Trace-model availability

Muse Spark 1.3 returned "Model access is disabled" on the OpenCode key (it is not in that key's model list), and the free OpenCode chat models are restricted to the OpenCode client, so neither was used. OpenRouter lists `meta/muse-spark-1.3` at $1.25 / $4.25 per million tokens; the remaining credit was too small for six agent runs.

Additional files: `extract_traces.py`, `analyze_traces.py`, `traces.json` (all steps and file contents), `results-traces-2026-10-18.jsonl`, `analysis-traces-output.txt`, `labeling-sheet.csv`; runner `scripts/evaluate-jev-traces.mjs`.
