# Speaker script: kick-off talk, 17.11.2026

About 5.5 minutes spoken (≈ 770 words), then discussion. [Brackets] are cues, not text.

## 1 · Title (~20 s)

Hi everyone, and welcome to my master's thesis kick-off. My thesis will be called "Knowing Where to Pause: Timing a Blocking Intervention for Understanding AI-Generated Code".

## 2 · Looks good to me… (~20 s)

With that, lets start with an example. An engineer builds a homework submission tool for a university with an AI agent. The agent writes hundreds of lines of code, we dont really understand what happens, all tests pass, looks good and we approve.

We merge agent code faster than we understand it and approving just becomes a habit.

## 3 · Research question (~40 s)

One idea is to step in with an intervention. Research shows that making people think with intervention can increase understanding and over-reliance on AI.
It depends on the design though: generic prompts can even make it worse. So how you intervene matters. In my thesis i will focus on the timing of such an intervention, where do you optimally put such an intervention and does it even matter?

But first we need to clear where an agent can pause at all. An agent works in a loop of reasoning and tool calls, with no natural steps. 
So in my study, the agent plans each feature as four subtasks. For homework submission: types, submitting, grading, and finally route and tests. My intervention is a blocking pause with a question: the agent stops, you
accept or reject its code, and you answer one question about what the code does. Only then does it continue. A pause can only come between two subtasks, and each feature gets exactly one. But where should it go?

## 4 · The agent decided for you (~30 s)

But before we come to the placement of pauses, lets get back to the example from before. A student submits his homework twice. The agent's code rejects the second
submission, so the first one counts. Replacing it would be just as reasonable, and the request doesn't specify which. So the agent silently decided for you.

I call that a decision point: the agent settles something the request left open, and the rest builds on it. My idea is to pause right there.

## 5 · One pause, three places (~30 s)

So I compare three places. First the end, once everything is built. 
The decision point, here after submitting in the middle after task 2.
And another subtask, with about the same amount of code to review. That's my control condition: it tells me whether the place matters, or just pausing in the middle.

My hypothesis: A closer look at a decision point should help you understand the whole feature better, more than a look anywhere else.

## 6 · Study: real agent, hidden script (~80 s)

Here's a session from start to end. It's online and takes about an hour. After a short questionnaire and a practice
round, participants work through six features, all in the same way.

They read the request and approve a plan with four subtasks. Then the agent codes. It's opencode with a real model
that follows a hidden script. In that script I write the design decisions, including the decision point and, in half
the features, a flaw.

At one point the agent stops. Where depends on the condition: at the end, after the decision point, or after another
subtask. The participant looks at the code and accepts or rejects it. Then they answer one question about what the
code does, and they can run it to check. After that they can still change their mind. Then the agent finishes.

When the feature is done, the code is hidden, and they answer five questions, each with a confidence rating. By
understanding I mean: can you predict what the code does in the cases that matter, without looking at it?

At the end I explain the hidden script and the flaws. Thirty developers, and each one sees all three conditions.

## 7 · Recap & your thoughts (~45 s, then discussion)

Quick recap. We approve agent code we don't really understand. My idea: pause right after a decision point, where the
agent settled something the request left open. I test that with one blocking pause at three places.

Where I am: the concept, the criteria and the study harness are done. Right now I'm deploying it, next is a pilot with
three to five people.

Two things are still open, and I'd love your thoughts. First, developer acceptance: would people accept a blocking
pause, or switch it off like the per-edit prompts? Second, setting decision points: right now I do that by hand. An LLM
could find them instead, either to check my choices or to decide when to pause.

On the right are things I'm exploring on the side, and I'm happy to discuss those too: what the pause should show,
whether the pause itself works as a cue, TypeScript familiarity, and confidence versus correctness.

---

## If asked

### The script and the decision point

**What does the script look like?** Three layers per feature. (1) The user story with acceptance criteria: the
participant sees it. (2) The public plan: four steps with files and functions, but no design decisions; the
participant approves it. (3) The step outline: the same four steps plus their design decisions, including the
decision-point case and, in the flawed variant, the flaw; only the agent sees it. On top, general rules for every
feature: exactly four steps in order, about 10–40 lines each, call a review checkpoint after steps 1–3, implement the
outline's decisions without commenting on them, don't ask questions. At each checkpoint the harness decides, by
condition, whether the agent waits for the participant.

**How is the decision point planted?** I write a story whose acceptance criteria leave one case open, like a second
submission. The step outline settles that case in one step, for example "reject, the first one counts", and that step is marked
as the decision point. The agent then writes the code itself. I check per trial that the decision really landed, and I
grade all answers against the code the agent actually wrote.

**Why a decision point and not random pauses?** Other step is close to a random pause: another subtask, drawn at
random, with about the same amount of code. That's the control. Random pauses alone could only show whether pausing
helps, not where. The decision point has reasons behind it: interruptions cost less at subtask boundaries, and
some boundaries are cheaper than others (Iqbal & Bailey); models decide silently instead of asking when the spec is open (Mu et al., Yang et al.); and later code builds
on the decision, so now is the cheapest moment to catch it (Kravchuk-Kirilyuk et al.). It's also a rule a system could
implement: pause where the agent settled something open.

**Isn't the agent unrealistic with a hidden script?** It really codes: it reads the project, uses tools, writes and
tests its own code. Only the design decisions are fixed, so that the conditions stay comparable. That's the trade-off
between realism and control.

**Why exactly four subtasks?** Agents have no natural steps; plan items are the closest thing. A fixed four keeps the
pause positions comparable across features.

**Does the model follow the script?** In test runs it did: all step checks passed, with no retries and no leaks of the
hidden plan. A flaw that doesn't land is flagged per trial.

**Who decides what a decision point is?** So far I do, by hand, when I write the stories. A second rater could check
my choices, or an LLM judge on the code; a detector could also run in shadow mode during the study.

### Agentic coding in 2026

**How do people review agent code today?** Two worlds. Background agents (Codex, Copilot coding agent, Devin) open a
pull request, so review comes at the end; most agent PRs get no human review at all, and when they do, other AI agents
dominate (Duma et al. 2026, arXiv:2605.02273). 79 % of merged agent PRs show no visible feedback (Peralta et al. 2026,
arXiv:2605.22534). Interactive agents (Claude Code, Codex CLI, Cursor) follow plan → approve → agent runs on its own →
diff at the end. Hardly any tool stops on purpose in the middle of the work. That's the gap I look at.

**Why not let the agent ask in plan mode instead?** Plan-mode questions catch what's open in the prompt. Decision points
appear while the code is written: the open case only shows up once the agent hits it. Agents also ask less than users
want, and asking helps most when the work itself exposes the gap (Edwards & Schuster 2026, EMNLP Findings). In my study
the agent is told not to ask; that stands for the gaps planning doesn't find. Honest caveat: some of my open cases a good
agent could have asked about upfront; I'm checking the stories for that.

**Isn't per-edit approval the other extreme you should compare against?** It's being retired. Claude Code users approved
93 % of permission prompts, and auto mode is now the default. Today's real alternatives are reviewing the plan upfront
and AI review afterwards.

**Would developers accept a blocking pause?** Frequent prompts get switched off (approval fatigue). Targeted stops are
wanted: 57 % of 203 developers want agents to pause when instructions are ambiguous, 65 % before critical code (Wu et
al. 2026, arXiv:2611.10058). One pause per feature at a reasoned place is on the right side of that line. The open
question is whether developers trust a place a machine picked.

**Why does a human need to understand the code if an AI reviews it?** Responsibility stays with a person. Reviewers
increasingly require a known human owner before they accept AI pull requests (Rahman et al. 2026, arXiv:2610.11179).
And 51 % find problems in plausible-looking agent code hard to spot, 69 % say line-by-line review can't keep up (Wu et
al. 2026).

**Is a quiz right after the task a fair measure of understanding?** It's the same approach as a recent randomized
study: developers who used AI scored 17 % lower on a quiz right after the task, most of all on debugging (Shen & Tamkin
2026, arXiv:2601.20245). There, people who had the generated code explained to them scored much better, which also
supports the behaviour question as part of the intervention.

**Why a behaviour question at all?** A pause alone can be clicked away; approving becomes a habit (Yu et al.). A
question you must answer forces engagement with the code, a cognitive forcing function (Buçinca et al.). It asks what
the code does for a given input, answered by running it, which targets exactly what "looks good" hides. And it gives a
measure: people decide before the question and confirm or reverse after it.

### Design and analysis

**Why not just ask the agent?** You can, if you know what to ask. The hard part is noticing that a decision was
made at all; 390 lines hold dozens of them. And an answer per case isn't understanding: you still need to know the
code to maintain it, and the agent's explanation describes its intent, not necessarily what the code does.

**Why is there no condition without any pause?** Pausing to make people think is already known to help (cognitive
forcing). And no real workflow skips review entirely: at the latest, someone looks at the result. A no-pause condition
would also differ in how much review happens. So I hold the amount fixed, one review per feature, and vary only where
it falls. The end is today's default and serves as the baseline.

**Isn't the behaviour question a confound?** At the decision pause it asks about that decision. Leaning towards a fixed
rule: one question about the subtask just finished, the same in all conditions, plus one understanding item per
subtask 1–3. Then I test whether a review helps its own subtask's item more when that subtask is the decision point.

**What exactly is the hypothesis?** Understanding of the whole feature is better after a pause at the decision than at
the end or at another step; for the decision itself the effect should be largest.

**How large an effect can you find with 30 people?** The current simulation is from an older version with four items
per feature; with five items per feature over the whole feature there are more data points. To be rerun before the
pilot.

**Wasn't this called "milestone"?** Yes, in the exposé ("semantic milestone") and in the study code (BATCH,
NON_MILESTONE, MILESTONE). For the talk I use plainer names.

**Why a live model instead of a recorded session?** Realism; the supervisors preferred it. The cost is variation, so I
check per trial whether the flaw landed and grade every answer on the code the agent actually wrote.

**Is hiding the script and the flaws OK?** Participants are told everything in the debrief. Open point for the ethics
review: whether to say upfront that code may contain flaws.
