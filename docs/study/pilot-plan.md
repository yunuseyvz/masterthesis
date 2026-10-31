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

## Known before the pilot

- **Manipulation check.** A Flawed trial can end up correct: in US1 the agent sometimes refuses to remove sold-out
  items (about a third of test runs), and a participant's answer after a rejection can fix the flaw. The behaviour
  question's outcome shows per trial whether the flaw was in the reviewed code; the analysis should use it.
- **No flaw region.** Where the flaw lies in the agent's code is not known, so the flaw-region measures
  (`flawRegionMs*`, `flawRegionSeen*`) stay 0/false.
- **Isolation.** The sandboxed terminal can reach the model endpoint and the checkpoint server over loopback.
  Accepted; sessions are supervised.
- The model, the Drehbuch and the outlines are frozen before the first participant.
