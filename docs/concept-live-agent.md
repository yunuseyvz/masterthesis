# The live agent: design and test runs

Since the supervisor meeting of 29.10 the study no longer replays recorded sessions. A real model plays the agent
live, following a hidden script per story, the **Drehbuch**. This document records the design decisions and how the
agent did in test runs. How it is built: [technical.md](technical.md) §3–§5.

## 1. Decisions

**The Drehbuch is added on the way to the model.** The study server's model endpoint appends it to the system prompt
of the trial's main conversation. It is not in `AGENTS.md`, a custom agent or opencode's config, because the
participant's sandboxed terminal can read those, and the Flawed outline would give the condition away.

**The checkpoint is a tool the agent calls.** The Drehbuch makes the agent call `review_checkpoint` after steps 1–3,
in every regime, so the conversation looks the same in all of them. The study decides whether a call returns at once
or is held until the participant has reviewed. The pause therefore does not depend on the model stopping by itself.

**A flaw is a wrong design decision, not a bug order.** Models refuse to plant bugs, mention them, or overdo them.
Instead, the Flawed outline states one plausible but wrong decision that contradicts the user story, and the
Drehbuch says the team's decisions are final. The participant sees only the user story, so the flaw shows up as in
real reviews: as a mismatch between the request and the code.

**Questions are graded on the code as played.** The question texts are fixed; the answer key comes from running the
trial's scripts on the agent's code (the behaviour question when it is asked, the understanding items at the end). If
the code does something no option says, that outcome replaces a distractor. Item 4 of every story asks about
behaviour that holds whatever the code looks like: in US0, US3, US4 and US6 whether the agent's own tests would
notice a given change (the script swaps in the mutant and runs them); in US1, US2 and US5 what the finished route or
middleware answers.

**A rejection goes back to the agent.** After a rejection the agent asks in the chat what to change, the
participant answers once in opencode's own composer, and the agent fixes the step before going on. The answer and
the time to write it are recorded.

**One codebase, a fresh copy per trial.** Every story starts from the same project (`shopfront`), so after the
practice story participants know the codebase; no story's code carries over to the next.

**Planning happens in the background.** The next trial's agent explores and plans while the participant answers
the questionnaire or the previous trial's understanding questions.

## 2. Test runs

DeepSeek V4.1 Flash on OpenCode Go, with `live-run.ts`, over two rounds (13 and 25 runs) plus extra runs of US1:

- **Adherence**: every run kept to the four steps and called the checkpoint after steps 1–3; no pause was missed.
- **Gradeable**: every item's script described the code in every run.
- **Flaw landed**: 15 of 15 Flawed runs outside US1. In US1 about two thirds: the agent sometimes refuses to remove
  sold-out items (about a third of runs), and an earlier version of the flaw (overselling) landed in 4–5 of 10.
- **Rejection**: in three runs with a specific answer (US5 paused, US4 BATCH), the agent asked one question, ended
  its turn, fixed the flaw as asked, called the checkpoint again and passed its tests.
- Planning took 16–52 s per story in a participant session; a whole rejection run, plan included, 1.3–1.5 minutes.

## 3. Open points

- **Manipulation check.** A Flawed trial can end up correct (US1 above, or a participant's fix). The behaviour
  question's outcome shows per trial whether the flaw was in the reviewed code; the analysis should use it.
- **The mutation items** (item 4 in US0, US3, US4, US6) were answered "Yes, a test fails" in every test run so far,
  so they may not discriminate. Revisit after the pilot.
- **No flaw region.** Where the flaw lies in the agent's code is not known, so the telemetry's flaw-region measures
  (`flawRegionMs*`, `flawRegionSeen*`) stay 0/false.
- **Isolation**: the sandboxed terminal can reach the model endpoint and the checkpoint server over loopback.
  Accepted; sessions are supervised.
- The model, the Drehbuch and the outlines are frozen before the first participant.
