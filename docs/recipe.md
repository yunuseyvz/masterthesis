# Recipe: how the study is built

Step by step, how this study was put together and how to rebuild or rerun it. Each step names what it produces, where
that lives, and how it is checked. Details are in the linked documents; this file is the order.

| Phase | What | Detail |
|---|---|---|
| 1 | Question and conditions | [study-design.md](study-design.md) |
| 2 | Base project | `study-harness/project/` |
| 3 | Harness | [harness.md](harness.md) |
| 4 | Stories and questions | [stimuli.md](stimuli.md) |
| 5 | Session plan and counterbalancing | `shared/src/session.ts` |
| 6 | Instruments and data | [data.md](data.md) |
| 7 | Analysis plan and power | [analysis-plan.md](analysis-plan.md) |
| 8 | Checks before the pilot | below |
| 9 | Pilot | below |
| 10 | Data collection and analysis | below |

## 1. Question and conditions

1. **Research question:** does *where* a coding agent pauses for review affect how well developers understand and judge
   the code it writes?
2. **Define the milestone** with three criteria that must all hold: an open case is settled (the story is silent, more
   than one outcome is reasonable), later code builds on it (tests do not count), and that code does not exist yet.
3. **Fix the conditions**, one mandatory pause per feature:
   - BATCH: one review at the end
   - MILESTONE: a pause right after the milestone subtask
   - NON_MILESTONE: a pause after another subtask of similar size
4. **Fix the comparison that carries the claim:** MILESTONE vs. NON_MILESTONE (same number of pauses, similar amount of
   code, different place). MILESTONE vs. BATCH changes place and amount together and only answers "partway vs. end".
5. **Fix the design:** within participants, six measured features, two per condition, in each condition one Correct
   and one Flawed variant, plus one practice feature.

## 2. Base project

1. A small Next.js shop in TypeScript (`study-harness/project/`), in-memory data, no setup. Every trial starts from a
   fresh copy of it.
2. Business logic in `src/lib/` without framework imports, so scripts can call it directly; tests run with Node's
   built-in runner (`npm test`, Node 24, TypeScript without a build step).
3. The README states conventions (for example "amounts are integer cents") that a flaw may contradict.
4. **Made with an LLM:** Claude Opus 5.5 generated the project from fixed requirements (domain, size, simple
   structure, no setup); it was then simplified and shortened by hand. The aim is a small, plain codebase (about 520
   lines of TypeScript in `src/` and `test/`) so that the code around a feature does not become a confounder.
   Prompt: [TODO: link to prompt or chat log]. Recorded under Provenance in [stimuli.md](stimuli.md).

## 3. Harness

The participant works in the real opencode web app (v2.1.3, study build); a real model (DeepSeek V4.1 Flash) plays the
agent live.

1. **Study build of opencode:** `study-harness/agent-ui/build.sh` clones opencode at the pinned tag, adds the study
   module (`agent-ui/study/`) and applies `agent-ui/opencode.patch`. Output: `agent-ui/dist`.
2. **Hidden script (Drehbuch):** the study server sits between opencode and the model (`server/src/live.ts`). It adds
   `trials/drehbuch.md` and the feature's secret outline to the system prompt on the way upstream, so neither opencode
   nor the participant's terminal can read it.
3. **Pause as a tool:** the agent calls `review_checkpoint` after subtasks 1–3 in every condition. The server answers at
   once or holds the call while the participant reviews. So the conversation looks the same in every condition and
   the pause does not depend on the model stopping by itself.
4. **What a pause shows:** after each subtask the server commits the work, so at a pause the working tree holds exactly
   the paused subtask. The changes view shows only the working tree ("Git changes") and reloads when a review starts.
   Before the final look the server resets these commits (the files stay), so in every condition it shows the whole
   feature.
5. **Plan on screen:** fixed public text per feature, the same in both variants; the model's own plan is not shown.
6. **Grading on the code as played:** answers are scored by running each feature's scripts on the code the agent
   actually wrote, as a separate user in a private directory.
7. **Isolation, limits, deployment:** see [harness.md](harness.md) (sandbox users, inactivity limits 10 + 10 min and
   120 min, Conditioner).

Check: `npm run typecheck` and `npm test` (unit, flow and trial tests; `OPENCODE_IT=1` adds real-opencode tests).

## 4. Stories and questions

Every story is made by the nine-step recipe in [stimuli.md](stimuli.md). In short:

| # | Step | By |
|---|---|---|
| 1 | Choose the slot: milestone and flaw subtask (fixed spread across the six stories) | hand |
| 2 | Write the story and acceptance criteria; name the open case and two reasonable solutions | LLM draft allowed, decided by hand |
| 3 | Choose the flaw: which criterion it contradicts, which input shows it | LLM proposals allowed, chosen by hand |
| 4 | Secret outlines (Correct, Flawed) and the public plan | LLM draft allowed |
| 5 | Behaviour questions and five understanding items with four options each | LLM draft allowed |
| 6 | Files in `trials/<id>/`, one live run, the checked reference code | `npm test` |
| 7 | Evaluation matrix: several live runs per variant | live runs |
| 8 | Guessing check without code | 2 people |
| 9 | Contestability check and second rater for the milestone | 3–5 people |

Every use of an LLM is recorded under Provenance in [stimuli.md](stimuli.md).

## 5. Session plan and counterbalancing

1. `shared/src/session.ts` turns participant ID, seed, group and round into a session plan.
2. **Order:** a 6 × 6 Williams design (`WILLIAMS_6`) fixes the order of the six features per group.
3. **Conditions:** story *s* in group *g* gets cell (*s* + *g*) mod 6 of the six regime × variant cells, so across the
   six groups every story meets every cell once.
4. **NON_MILESTONE pause step:** never after a declarative subtask; where two subtasks qualify (only US1), the round
   alternates them.
5. **Option order:** shuffled per participant from the seed.
6. **Assignment:** `run-session.sh` (or Conditioner's 12 conditions, group × round) fills the groups in turn, so at any
   N they differ by at most one person.

## 6. Instruments and data

Session flow: consent (Conditioner's entry page) → questionnaire → introduction → guided practice (US0) → summary page →
six features → preference ranking → debrief.

| When | What |
|---|---|
| Before | Demographics and experience; Need for Cognition (6 items) with an attention check; trust in AI coding assistants (3 items, 1–7) |
| Per feature, at the review | Accept or reject; behaviour question (may run the code, "I don't know" allowed); optional reversal; after a rejection one message to the agent |
| Per feature, after it, code hidden | Five understanding items, each with confidence (25–100 %); mental effort (Paas, 1–9); three statements about the review (1–7) |
| After | Preference ranking of the ways of working, free text; debrief |
| Throughout | Timings, interactions in the changes view, files, terminal, the agent session, a screen recording |

Everything recorded is listed in [data.md](data.md); exports go to `exports/` (`trials.csv`, a bundle and events per
session).

## 7. Analysis plan and power

1. **Write the plan before data:** [analysis-plan.md](analysis-plan.md), H1–H5, models, exclusions, stopping rule.
2. **Code it:** `analysis/analyze.R` runs the planned models on `trials.csv`.
3. **Test it on fictitious data:**
   ```sh
   npx tsx analysis/design.ts 30 > design.csv
   Rscript analysis/simulate.R design.csv trials.csv
   Rscript analysis/analyze.R trials.csv
   ```
4. **Power by simulation:** `Rscript analysis/power.R 250 24,30,36` (about 45 min on 4 cores); results in
   `analysis/scenario/power.txt`.

## 8. Checks before the pilot

| Check | How | Passes when |
|---|---|---|
| Tests | `npm run typecheck`, `npm test` | no errors |
| Evaluation matrix | `server/src/live-run.ts` several times per story and variant | the flaw lands, every item can be graded, the emergent decision varies |
| Guessing check | `npx tsx analysis/pilot/guess-check.ts sheet SEED`, then `grade SEED:answers.txt …` | below 22 of 60 correct without code |
| Contestability | 3–5 people judge Correct and Flawed against the story, blind | Flawed seen as a fault, Correct not |
| Second rater | a second person judges each milestone against the criteria (phase 1) | every milestone meets them |
| Walkthrough | one whole session clicked through in a browser as a participant (`run-session.sh --demo`) | every phase works, the review shows the right code |

## 9. Pilot

1. A few sessions with real people, run exactly as the study.
2. Read them with `npx tsx analysis/pilot/pilot-check.ts EXPORT_DIR`: session length, difficulty per item and role,
   idle stretches per phase.
3. Change only stimuli and limits, never the hypotheses; rerun power with the pilot's baseline and variances only.
4. Pilot data are not analysed with the study data.

## 10. Data collection and analysis

1. Run sessions in group order (`study-harness/scripts/run-session.sh`, or online through Conditioner).
2. During collection check only exclusions and technical faults (`featureComplete`, `pauseMissed`, attention check),
   never the outcomes.
3. Stop by schedule or participant supply, never by results.
4. Analyse once: `Rscript analysis/analyze.R exports/trials.csv [excluded IDs]`.

## Decision log

Decisions that shaped the study, with their reason. Details in the linked documents.

| Date | Decision | Reason |
|---|---|---|
| 19.10.2026 | One small, plain base project (a shop), generated by an LLM and simplified by hand | Unfamiliar or complex surrounding code would add a confounder to understanding |
| 07.11.2026 | Stories carry acceptance criteria; the flaw contradicts one of them | Without a criterion a flaw is a matter of opinion, and fault detection has no ground truth |
| 09.11.2026 | A flaw in the milestone subtask is a separate wrong decision; the open case is solved the same in both variants | The open case is something the story is silent on; a flaw must contradict it |
| 15.11.2026 | H1 is understanding of the whole feature (all five items), also reported without the flaw item | One item per feature is too noisy; the flaw item is answerable from the criterion in Correct |
| 18.11.2026 | Behaviour questions ask for the consequence of an input, never a constant or type | A lookup question is an easier pause; checking that something exists is not understanding |
| 21.11.2026 | The pause is mandatory; only an inactivity guard limits time (10 + 10 min, 120 min cap) | Supervisor meeting 19.11; the guard protects the server, it is not a review budget |
| 21.11.2026 | NON_MILESTONE never pauses after a declarative subtask | Such a pause shows nothing to run and would not be comparable |
| 21.11.2026 | Three statements about each review (1–7), descriptive only | How the pause felt, without adding tests |
| 21.11.2026 | Fault detection (H3) gets the flaw's position relative to the pause as a covariate and is exploratory | Whether a flaw could be seen decides detection; power is only 2–7 % |
| 21.11.2026 | N is not fixed (about 30); collection stops by schedule, analysis once | Stopping on results inflates false positives |
| 21.11.2026 | Recipe for stimuli; steps 1–3 by hand, LLM use recorded | Supervisor meeting 19.11: the stimuli must be reproducible |
| 21.11.2026 | Answer options reworded so the correct one no longer stands out by length or an explanation | The longest option was correct in 13 of 30 items |
| 22.11.2026 | The changes view shows only the working tree and reloads at each review | In the walkthrough a pause showed no code, or all earlier subtasks together |
| 24.11.2026 | Stories use everyday shop terms (product, seller, refund, bill) instead of business jargon (SKU, tenant, SLA, invoice, gateway); logic, open cases, flaws and answers unchanged | Jargon from one domain would make understanding depend on domain knowledge, a confounder |
| 24.11.2026 | Base project and the LLM's part in steps 2–3 recorded as they happened | The stories' wording, criteria and proposals for open cases and flaws came from an LLM; the documents must say so |
| 27.11.2026 | The final look shows the whole feature in every condition | Before, the steps before a pause never appeared in the changes view. NON_MILESTONE pauses later on average (step 2.5 vs. 2.0), so 8 of 30 items asked about code it never showed as a diff (MILESTONE: 1), and in 3.5 of 6 stories the milestone's code itself; the comparison would have measured exposure, not the place of the pause |

## Open

- Evaluation matrix, guessing check, contestability check and second rater have not run yet.
- Before going online: see "Still missing" in [harness.md](harness.md).
