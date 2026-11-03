# Pilot plan

A small check before data collection.

## Pilot of the understanding questions (3 to 5 people)

**Goal.** Make sure the four questions per feature measure understanding, are not guessable, and fit the time budget.

**Who.** Three to five people with programming experience who are not in the later sample. Run the full session (`study-harness/scripts/run-session.sh --show-condition` is for you, never for them).

**What to look at** (from the exported `trials.csv` and the logs):

| Check | Look at | Fix if |
|---|---|---|
| Too easy / too hard | `u1..u4_correct` per feature | one item is correct for everyone, or for nobody |
| Guessable | accuracy vs. the 25% chance level, option order | an item is answered above chance without having read the code |
| All regimes work | the same items in BATCH, MILESTONE and NON_MILESTONE | an item only makes sense after one regime |
| Time | session length | well over 60 minutes |
| Wording | what the person says when asked "what did question k ask?" | they read it differently from your intent |
| Wrap-up screen | do people understand why they see more code after the decision | confusion or skipping |

**Stop rule.** Change at most the wording and the options, then re-run two people. Do not tune items on the pilot data beyond that.

## The live agent (same sessions)

The agent is a real model, so the pilot also checks what it played (from the event log; `docs/harness/telemetry.md`
§6).

| Check | Look at | Fix if |
|---|---|---|
| Kept to the Drehbuch | `live_checkpoint` after steps 1–3, `live_pause_missed`, the commits | a step was skipped or the pause missed |
| Flaw landed | in Flawed trials, `live_probe` (and `live_key`) against the variant's expected answer | a flaw does not land; then the outline needs another wording |
| Questions gradeable | `live_probe`, `live_key`: no outcome starting with `?` or missing | a script cannot describe the agent's code |
| Mutation items discriminate | item 4 in US0, US3, US4, US6: answered "Yes, a test fails" in every test run so far | everyone gets the same key |
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
  outline") or "Plan mode". A Drehbuch rule and an `"outline"` entry in `planLeaks` are proposed, not built yet.
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
  Accepted; sessions are supervised.
- The model, the Drehbuch and the outlines are frozen before the first participant.
