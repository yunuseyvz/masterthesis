# Pilot plan

A small check before data collection, in this order: the guessing check (two people, no code), then the pilot sessions
(three to five people), then the power rerun. Nothing in the pilot counts toward the study.

## Guessing check (2 people, without the code)

**Goal.** Measure how much of the understanding questions can be answered without the code: from the request, its
acceptance criteria and the plan, which every participant sees before the agent writes anything.

**Who.** Two people with programming experience who are neither in the pilot nor in the sample.

**How.** One questionnaire per person, each with its own option order:

```
npx tsx analysis/guess-check.ts sheet 11 > sheet-11.md    # person 1; person 2 gets another seed
```

The sheet has the six measured features (request, plan, the five questions each); about 20 minutes. Everything is
answered, guesses included. The answers go into a text file, one line per question (`US1 1 B`), then:

```
npx tsx analysis/guess-check.ts grade 11:answers-1.txt 12:answers-2.txt
```

**Reading it.**

| What | Expected | Fix if |
|---|---|---|
| All 60 answers | at chance, 25 % (15 of 60) | 22 or more right (37 %, one-sided p < .05): the options give answers away |
| Open-case items | at chance | right for both: the request does not leave the case open; reword the request or the case |
| Flaw items | the Correct key is what the acceptance criterion says, so they are often right | not a fault: the flaw contradicts a criterion by construction (`story-spec.md`). In a Correct trial the item can be answered from the criterion; the H1 sensitivity analysis without the flaw item covers it |
| Dependency, interplay, emergent | at chance | right for both: make the wrong options as plausible as the right one, keep the scenario |

The emergent item's key depends on what the agent decides; the check grades it against the reference, so a hit there
only says the reference's choice is the obvious one.

## Pilot of the understanding questions (3 to 5 people)

**Goal.** Make sure the five questions per feature measure understanding, are not guessable, and fit the time budget.

**Who.** Three to five people with programming experience who are not in the later sample. Run the full session (`study-harness/scripts/run-session.sh --show-condition` is for you, never for them).

**What to look at** (from the exported `trials.csv` and the logs; `npx tsx analysis/pilot-check.ts <export dir>` prints
session lengths, every item's share correct, confidence and time, shares per role and regime, and the stretches without
input):

| Check | Look at | Fix if |
|---|---|---|
| Too easy / too hard | `u1..u5_correct` per feature (flagged by `pilot-check.ts`) | one item is correct for everyone, or for nobody |
| Difficulty per role | share correct per role (open case, dependency, flaw, interplay, emergent) | a role is near 100 % or near 25 % across features: the whole role is too easy or unanswerable, not one item. With 3–5 people only extremes count |
| Guessable | accuracy vs. the 25% chance level, option order | an item is answered above chance without having read the code |
| All regimes work | the same items in BATCH, MILESTONE and NON_MILESTONE | an item only makes sense after one regime |
| Time | session length | well over 60 minutes |
| Wording | what the person says when asked "what did question k ask?" | they read it differently from your intent |
| Wrap-up screen | do people understand why they see more code after the decision | confusion or skipping |

**Stop rule.** Change at most the wording and the options, then re-run two people. Do not tune items on the pilot data beyond that.

### "Are you still there?" (same sessions)

The server asks after 10 minutes without input while the participant is to act, and ends the session 10 minutes later
without an answer; at most 120 minutes per session (`docs/harness/technical.md` §10.1). The pilot shows whether that
fits people who are there, since a moderated session tells who was.

| Check | Look at | Fix if |
|---|---|---|
| Nobody present is asked | `afk_prompt` in the logs; the stretches without input per phase (`pilot-check.ts`) | someone present was asked, or a stretch comes within 2–3 minutes of the limit (reading the plan, thinking over a question): raise `STUDY_AFK_WARN_MIN` |
| The session fits the cap | session length (`pilot-check.ts`) | a session takes over 90 minutes: shorten the session, or raise `STUDY_MAX_SESSION_MIN` |

## Power after the pilot

`analysis/power.R` rests on guessed values (`truth_default` in `analysis/simulate.R`). Replace those the pilot can
give, roughly at 3–5 people: the share correct per role in BATCH as the baseline (`base`, `milestone_gap`), and the
spread between people. Not the regime differences: those are what the study tests. Then rerun
`Rscript analysis/power.R 250 24,30,36` and update `docs/study/scenario.md` §3.

## The live agent (same sessions)

The agent is a real model, so the pilot also checks what it played (from the event log; `docs/harness/telemetry.md`
§6).

| Check | Look at | Fix if |
|---|---|---|
| Kept to the Drehbuch | `live_checkpoint` after steps 1–3, `live_pause_go_on`, `live_pause_missed`, `live_go_on`, `live_incomplete`, the commits | a step was skipped, the pause missed or the feature left unfinished |
| Flaw landed | in Flawed trials, `live_probe` (and `live_key`) against the variant's expected answer | a flaw does not land; then the outline needs another wording |
| Questions gradeable | `live_probe`, `live_key`: no outcome starting with `?` or missing | a script cannot describe the agent's code |
| Free decision varies | the `emergent` item's key in `live_key`, per feature | the agent decides the same way in every session (then the item is no longer emergent) |
| Text replaced | `live_text_leak` with `replaced` | a step's announcement is replaced in most sessions (then the outline's wording invites it) |
| Waiting | `waitedForPlanMs`, `agent_turn` durations | people wait long for the plan or the agent |
| Rejection | `feedback_*`: the agent's question, the answer, the fix | the agent does not ask, or ignores the answer |

## DeepSeek dry run (2 November 2026)

**Goal.** Run the whole live flow once, end to end, before the pilot: every regime, a real model, real grading, a real
export. This is not a pilot participant. The author took the participant's seat and knew every flaw, so the scores say
nothing about understanding; the run checks the harness.

**Setup.** DeepSeek `deepseek-v4.1-flash` through the live endpoint, the opencode agent, group 2, seed 2611, practice
plus six features. Actions went through the study API instead of a browser. The export is in `/tmp/sim-exports`,
outside `exports/`, so it does not count toward group assignment. Seven trials, 11 minutes, 118 model calls, about
1.64 M tokens (1.57 M prompt, 63 k completion).

| # | Story | Condition | Pause | Decision | Probe | Understanding | Note |
|---|---|---|---|---|---|---|---|
| P | US0 Greeting | MILESTONE · Correct | 2 | accept | ✓ | 4/4 | practice |
| 1 | US3 Tenants | MILESTONE · Flawed | 2 | reject | ✓ | 4/4 | rejected the cap, not the flaw; the agent rewrote step 2 |
| 2 | US4 SLA | NON_MILESTONE · Flawed | 3 | reject | ✓ | 4/4 | flaw in the paused step |
| 3 | US2 Webhook | BATCH · Flawed | 4 | reject | ✓ | 4/4 | whole feature; most expensive trial (458 k tokens) |
| 4 | US5 Rate limiter | BATCH · Correct | 4 | accept | ✓ | 4/4 | |
| 5 | US1 Reservation | NON_MILESTONE · Correct | 3 | accept | ✓ | 4/4 | |
| 6 | US6 Coupons | MILESTONE · Correct | 1 | accept | ✓ | 4/4 | |

**What it verified.**

- All 21 step checks passed on the first attempt. There were no plan retries and no summary leaks.
- Three rejections, one in each regime. Each time the agent asked one question, took one answer and fixed the step.
  In the pause trials the fix was committed with the step, so the final view held only the later steps; in BATCH it
  stayed in the working tree.
- In MILESTONE and NON_MILESTONE the review showed exactly the paused step; in BATCH it showed the whole feature.
- Grading followed the code as played: after the US3 rewrite, item 2's key became 500 instead of 100.
- No blocked agent requests and no server errors. Plans took 1.3–11.9 s, because the answers came within seconds; a
  real participant takes minutes, so the plan will be ready.

**What it exposed.**

- Three of seven plans mentioned the hidden outline ("the outline does not say so", "following the agreed step
  outline") or "Plan mode". Resolved since: the plan on screen is now a fixed public plan
  (`docs/harness/technical.md` §4.1).
- The US3 cap is contestable from the brief's "where they need to". The author rejected it as a participant; that is a
  design disagreement, not the injected flaw. Watch it in the pilot: the Correct condition may collect such
  rejections.
- The run used the study API, so UI telemetry and the screen recording are empty; only the API-side timing is present.
- One session, one group and one seed: this is a harness check, not evidence about the hypotheses.

## Known before the pilot

- **Manipulation check.** A Flawed trial can end up correct: in US1 the agent sometimes refuses to remove sold-out
  items (about a third of test runs), and a participant's answer after a rejection can fix the flaw. The behaviour
  question's outcome shows per trial whether the flaw was in the reviewed code; the analysis should use it.
- **No flaw region.** Where the flaw lies in the agent's code is not known, so the flaw-region measures
  (`flawRegionMs*`, `flawRegionSeen*`) stay 0/false.
- **Isolation.** The sandboxed terminal can reach the model endpoint and the checkpoint server over loopback.
  Accepted while a session is supervised (lab, or moderated over a video call); to be closed before unsupervised
  sessions (`docs/harness/deployment.md`).
- The model, the Drehbuch and the outlines are frozen before the first participant.
