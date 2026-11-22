# Stimuli

How a story and its questions are made, so that every story is made the same way and the thesis can say how the
stimuli came about. The files of a story are in `study-harness/trials/<id>/`.

## Fixed slots

The domains are free, the positions are not: the milestone is twice at each of subtasks 1, 2 and 3, and in three of six
stories the flaw is in the milestone subtask, so the position gives nothing away.

| Story | Milestone | Flaw | NON-MILESTONE pause |
|---|---|---|---|
| US0 (practice) | 2 | none | none |
| US1 | 2 | 2 | 1 or 3 |
| US2 | 3 | 2 | 2 |
| US3 | 2 | 3 | 3 |
| US4 | 1 | 3 | 3 |
| US5 | 3 | 3 | 2 |
| US6 | 1 | 1 | 3 |

NON-MILESTONE never pauses after a declarative subtask (types and constants only, `declarative` in `trial.json`), so
only US1 has two candidates.

**Checked by `npm test`:** four subtasks, exactly one milestone, the flaw in 1–3; subtasks 1–3 differ in changed lines
by at most a factor of 3, the milestone has at least 8; the variants differ only in the flaw subtask; the visible tests
pass in Correct; one behaviour question per subtask 1–3 and five understanding items, whose scripts print the expected
answer on the reference in both variants; milestone and flaw are never declarative; the public plan contains no
`planLeaks` match.

**Not checked by a test:**

- A milestone at subtask 3 needs production code in subtask 4 that builds on it (tests do not count).
- No acceptance criterion settles the open case.
- The flaw contradicts exactly one acceptance criterion, or a convention in the project README. The open case is solved
  the same way in both variants; the flaw is a separate decision in the same or another subtask.
- The visible tests do not find the flaw, and a script can observe it.

## The recipe

Every story goes through these steps in order; a step starts only once the previous one has passed its check.

| # | Step | Check |
|---|---|---|
| 1 | Choose the slot: milestone and flaw subtask | The seven slots stay spread as above |
| 2 | Story with acceptance criteria, then the open case: what is it silent on, which two solutions are reasonable? | No criterion settles the case |
| 3 | The flaw: which criterion it contradicts, how a script sees it | Correct and Flawed answer one input differently |
| 4 | Secret plan (`outline-correct.md`, `outline-flawed.md`) and public plan (`plan-public.md`) | The public plan names files, not values (`planLeaks`) |
| 5 | Behaviour questions and understanding items, by the rules below | The self-check below |
| 6 | Files in `trials/<id>/`, one live run, the reference (`reference/`) | `npm test` |
| 7 | Evaluation matrix: several live runs per variant | The flaw lands, every item can be graded, the emergent decision varies |
| 8 | Guessing check without code (`analysis/pilot/guess-check.ts`) | No item is solvable by everyone without code, except the flaw item in Correct |
| 9 | Contestability check: 3–5 people judge blind whether Flawed and Correct contradict the story; a second person judges the milestone against the criterion in `docs/study-design.md` | Flawed is seen as a fault, Correct is not; the milestone meets the criterion |

**Role of an LLM.** Steps 1–3 decide what a story measures and are done by hand. From step 4 an LLM may supply drafts
(wording, options, scripts, files); they are checked and adopted by hand. Every use is recorded under
[Provenance](#provenance): model, what for, and what was adopted.

Trying a draft without touching the real trials (step 6):

```sh
cp -r study-harness/trials /tmp/draft   # change the story there
cd study-harness/server && set -a && . ../../.env && set +a
TRIALS_DIR=/tmp/draft npx tsx src/live-run.ts --story US1 --variant Flawed --regime MILESTONE --model "$LIVE_MODEL"
```

## Questions

**Behaviour questions** (one per subtask 1–3, asked at the pause; the participant may run the code): an input and its
consequence for the story, never a constant or a type ("What is the default?"). The question about the flaw subtask
shows the flaw (Correct ≠ Flawed) in a different scenario from the flaw item: other numbers, preferably another
function, because BATCH always asks it. Exception kept on purpose: US2, US4 and US6, where H1 is also reported without
the flaw item.

**Understanding items** name a concrete input and ask for the consequence. The answer follows from the code;
`understanding.ts` determines it on the code as played. Story and public plan must not give it away.

| Role | The input | The answer depends on | Not |
|---|---|---|---|
| Open case (the milestone item) | hits exactly the case the story is silent on | the solution in the milestone subtask, the same in both variants | a case a criterion decides |
| Dependency | goes through a file written later that is not a test | what that file makes of the milestone decision | the open-case question one level up |
| Flaw | a scenario in which Correct and Flawed answer differently | the flaw subtask | the scenario of the behaviour question about the flaw subtask |
| Interplay | needs two subtasks that together give the answer | both subtasks; neither alone is enough | a case a criterion decides |
| Emergent | a case story and secret plan are silent on | the decision the model makes itself | a case with an obvious answer |

The flaw item is answerable from the violated criterion in Correct, by construction; H1 is therefore also reported
without it.

**Options.** Four, exactly one correct (for the flaw item one per variant). The wrong ones come from the sheet:

- Open case: the other reasonable solutions, plus at most one that violates a criterion.
- Flaw: the behaviour in Flawed is one option, the behaviour in Correct another.
- Emergent: the plausible outcomes; one no run would choose is not a distractor.
- Dependency, interplay: what would follow if the milestone decision had gone the other way, or if only one of the
  two subtasks counted.

The form gives nothing away: the correct option is not conspicuously longer and carries no explanation the others
lack; no option is obviously absurd (a number no code prints, a unit that does not fit); all four have the same form.
The harness shuffles the order per participant.

**Self-check** before step 6: Can someone answer an item from story and public plan alone? Is the correct option the
longest, or the only one with an explanation? Would an experienced person see Flawed as a fault knowing only the story,
and Correct not? Is the open case really open? Does a later non-test file build on the milestone? Does the title or a
subtask summary (`steps[].summary`, used as commit message) reveal a decision?

## Provenance

| Stories | By hand | With an LLM | Reference code |
|---|---|---|---|
| US0–US6 (as of 21.11.2026) | Slots, stories, open cases, flaws | DeepSeek V4.1 Flash 1017: drafts of texts and other material, checked and adopted by hand | Live runs of the agent (DeepSeek V4.1 Flash), checked by hand |
| US1–US6, options (21.11.2026) | Scenarios and correct answers unchanged | Claude Opus 5.5: rewording of 37 options in 16 items so the correct one no longer stands out by length or an added explanation; `understanding.ts` adjusted to print the new texts | Unchanged; `npm test` passes on both variants |

## Open

- Evaluation matrix (step 7), guessing check (step 8) and contestability check (step 9) have not run yet.
- Possibly solvable without code, for the guessing check: US2 item 4, US3 item 5, US4 item 5, US5 item 4.
- US5 item 5 (interplay) may depend on subtask 4 alone.
- After the option rewording the correct option is never the longest and in 18 of 30 items the second longest; left as
  it is until the guessing check.
