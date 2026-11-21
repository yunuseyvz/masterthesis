# Kick-off talk 17.11.2026: notes and defense

About four and a half minutes of talk, then discussion. Part 1 holds the presenter notes, the same as in the PPTX.
Part 2 is the preparation for questions: what to say, plus the facts behind it. Sources and their key claims are in
`citations.md`.

## Numbers to have at hand

| What | Number |
| --- | --- |
| Participants | ~30, online, within-subjects |
| Features per person | 6 (2 per condition, one correct and one flawed each) |
| Subtasks per feature | 4 (types · core · follow-up · route & tests) |
| Pauses per feature | exactly 1 (END, DECISION or OTHER STEP) |
| Questions after each feature | 5, code hidden, each with a confidence rating |
| Lines under review | END 160–390 · DECISION 29–63 · OTHER STEP 18–86 |
| Power (old simulation) | N = 30, both contrasts significant: 33 % at +18 points, 70 % at +26 · N = 60: 62 % at +18 (per contrast: 43 %, 79 %, 74 %) |
| Agent | real model (DeepSeek) in opencode, following a hidden script |

---

## Part 1 · Presenter notes

### 1 · Title (~20 s)

- Hi, welcome to my master's thesis kick-off
- Title: "Knowing Where to Pause – Timing a Blocking Intervention for Understanding AI-Generated Code"

### 2 · Looks good to me… (~20 s)

- Example: an engineer builds a homework submission tool with an AI agent
- Hundreds of lines, all tests pass → looks good → approve
- But we don't really understand what it does
- We merge agent code faster than we understand it; approving becomes a habit

### 3 · Research question (~40 s)

- Idea: step in with an intervention
- Making people think reduces over-reliance on AI (Buçinca)
- Design matters: questions about assumptions work best (Ghosh)
- My focus: the timing. Where to put it, and does it matter?
- Where can an agent pause at all? A loop of reasoning + tool calls, no natural steps
- In my study: four subtasks → types · submit · grading · route & tests
- Intervention = blocking pause + one question about what the code does; continues only after that
- One pause per feature, between two subtasks → where should it go?

### 4 · The agent decided for you (~30 s)

- Back to the example: a student submits twice [→ point at highlighted line]
- Agent rejects the second → the first one counts
- Replacing it would be just as reasonable; the request doesn't say → the agent silently decided for you
- Decision point = the agent settles something the request left open, and the rest builds on it
- My idea: pause right there

### 5 · One pause, three places (~30 s)

- END: once everything is built → today's default
- DECISION: right after the decision point (here: after submit)
- OTHER STEP: another subtask, same amount of code → control: the place, or just any pause?
- Hypothesis: a close look at the decision point → better understanding of the whole feature

### 6 · Study: real agent, hidden script (~80 s)

- Online, ~1 h: questionnaire + practice round → six features, same flow each
- Read the request → approve a plan with four subtasks
- Agent codes: opencode + real model + hidden script (I write the decisions: decision point, flaw in half)
- Agent stops once; where = condition (end · after decision point · other subtask)
- Review: accept / reject → behaviour question (can run the code) → may change their mind → agent finishes
- Feature done: code hidden, five questions + confidence
- Understanding = predicting what the code does in the cases that matter, without looking
- End: debrief on the hidden script and the flaws
- ~30 developers, within-subjects: all three conditions, two features each (one correct, one flawed)

### 7 · Recap & your thoughts (~45 s, then discussion)

- Problem: we approve agent code we don't really understand
- Idea: pause right after a decision point
- Test: one blocking pause at three places
- Status: concept, criteria, harness done → deploying now → pilot with 3–5 people next
- Open 1, developer acceptance: blocking pause accepted, or switched off?
- Open 2, setting decision points: by hand today. LLM to check my choices, or to decide when to pause?
- Exploring (right box), also open for discussion:
  - What the pause shows: today only the diff. Pointing at the decision would be stronger, but mixes place and content
  - Pause as a cue: does stopping itself say "look here"? A confound, or the point?
  - TypeScript familiarity: recorded (1–5), analysed as a moderator, not a factor
  - Confidence vs. correctness: calibration per condition (H3)

### Backup slides

- **8 · Hidden script:** story + public plan (participant) vs. step outline (agent only). The decision point and the
  flaw are in the outline; the harness decides per condition whether the agent waits.
- **9 · Power:** share of simulated studies in which both contrasts are significant. Old simulation (4 items, decision
  item only); say so if you show it.
- **10 · Six features:** decision points at steps 1, 2 and 3, two each, so position is no cue; half of the flaws sit
  in the decision step.
- **11 · References:** not presented.

---

## Part 2 · Defense

Format: **Q** is the question, **Say** is the answer to give (short), **Backup** is the facts in case they push back.

### A · The idea: decision points

**Q: Agents have got better at asking back when something is unclear. Why pause at all?**

- **Say:** Agents do ask more now, mostly in plan mode, about what's open in the prompt. But they can only ask about
  gaps they notice, and models are bad at noticing ambiguity on their own. Many open cases only show up while the code
  is written. And an agent that asks about everything gets switched off, so it still has to pick the moments that
  matter. That's the same question I study. Asking and pausing complement each other: asking happens before the
  decision, the pause lets you check what the code actually did.
- **Backup:**
  - Yang et al. 2026: models can't identify or resolve ambiguity by themselves and write different code for the same
    open requirement.
  - Edwards & Schuster 2026: asking helps most when the work itself exposes the gap; agents ask less than they should.
  - Approval fatigue: users approve 93 % of permission prompts (Anthropic, vendor figure).
- **If they push on the study:** The agent isn't allowed to ask on purpose. That stands for the gaps it doesn't
  notice, and it keeps the conditions comparable. Comparing asking with pausing would be a good follow-up study.

**Q: Why not just ask the agent what happens?**

- **Say:** You can, if you know what to ask. The hard part is noticing that a decision was made at all, and 390 lines
  hold dozens of them. And an answer isn't understanding: the agent's explanation describes its intent, not
  necessarily what the code does.

**Q: Real code has dozens of decision points. Your features have exactly one.**

- **Say:** True, that's a simplification for control. One planted decision point per feature lets me compare places
  cleanly. Real code would need prioritising: which open decisions are worth a pause. My criterion says it's the ones
  that later code builds on.
- **Backup:** One of the five questions per feature asks about something the agent decided on its own (the "emergent"
  item), so the study does look beyond the one planted decision.

**Q: Why the decision point and not random pauses?**

- **Say:** OTHER STEP is close to a random pause: another subtask with about the same amount of code. That's my
  control. Random pauses alone could only show that pausing helps, not where.
- **Backup:** Reasons for the decision point: some subtask boundaries are cheaper to interrupt at than others (Iqbal &
  Bailey); models fill open requirements silently (Mu, Yang); later code builds on the decision, so now is the cheapest
  moment to catch it (Kravchuk-Kirilyuk).

**Q: Who decides what a decision point is? Isn't that circular?**

- **Say:** Right now I do, by hand, when I write the stories, following a fixed criterion. Next comes a check by a
  second rater or an LLM judge on the code the agent actually wrote. A detector could run in shadow mode during the
  study without steering the pause.
- **Backup:** A live detector that sets the pause was rejected for this study: detector accuracy and place would get
  mixed up.

### B · The intervention

**Q: Why a behaviour question at all?**

- **Say:** A pause alone gets clicked away, and approving becomes a habit. A question you have to answer forces you to
  engage with the code. It asks what the code does for a concrete input, which is exactly what "looks good" hides.
- **Backup:** Yu et al. 2026 (habituation), Buçinca et al. 2021 (cognitive forcing). Also a measure: decide before the
  question, confirm or reverse after it.

**Q: Isn't the behaviour question a confound? At the decision pause it points straight at the decision.**

- **Say:** Good point, I'm aware of it. I'm leaning towards a fixed rule: the question always asks about the subtask
  just finished, the same in all conditions. Then I can test whether a review helps that subtask's question more when
  the subtask is the decision point.

**Q: Would developers accept a blocking pause?**

- **Say:** That's one of my open questions. Frequent prompts get switched off. Targeted stops are wanted, though: in a
  recent survey of 203 developers, 57 % want agents to pause when instructions are ambiguous, 65 % before critical
  code. One pause per feature at a reasoned place is on the right side of that line.
- **Backup:** Wu et al. 2026, arXiv:2611.10058.

**Q: Why not compare against approving every edit?**

- **Say:** That's being retired. Users approved 93 % of permission prompts, and auto mode is now the default in Claude
  Code. Today's real alternatives are reviewing the plan upfront and AI review afterwards.

### C · Study design

**Q: Why no condition without any pause?**

- **Say:** Every real workflow has a review, at the latest at the end. A no-pause condition would also differ in how
  much review happens. So I hold the amount fixed, one review per feature, and vary only the place. The end is today's
  default and the baseline.

**Q: The end shows all the code, the pauses only a fifth of it. Isn't that unfair?**

- **Say:** Yes, that's why there are two comparisons. DECISION vs. END asks whether it beats today's default.
  DECISION vs. OTHER STEP keeps the amount of code about equal and isolates the place.
- **Backup:** In the exposé this is listed as a limit: for END, timing and amount of code are confounded.

**Q: Isn't the agent unrealistic with a hidden script?**

- **Say:** It really codes: it reads the project, uses tools, and writes and tests its own code. Only the design
  decisions are fixed, so the conditions stay comparable. That's the trade-off between realism and control.

**Q: Does the model actually follow the script?**

- **Say:** In test runs, yes: all step checks passed, with no retries and no leaks of the hidden plan. I check per
  trial whether the flaw landed and grade every answer on the code the agent actually wrote.

**Q: Why exactly four subtasks?**

- **Say:** Agents have no natural steps; plan items are the closest thing. A fixed four keeps the pause positions
  comparable across features.

**Q: Why a live model instead of a recorded session?**

- **Say:** Realism, and my supervisors preferred it. The cost is variation, which I handle by grading on the actual
  code.

**Q: Is hiding the script and the flaws ethical?**

- **Say:** Everyone gets a full debrief. Whether to say upfront that code may contain flaws is still open for the
  ethics review.

### D · Measuring understanding

**Q: What exactly do you mean by understanding?**

- **Say:** Whether you can predict what the code does in the cases that matter, without looking at it.
- **Backup:**
  - **Format:** Five questions per feature, each a concrete situation with four possible outcomes, plus a confidence
    rating.
  - **Grading:** Answers are graded by running the code the agent actually wrote.
  - **The five roles:** the decision point's open case; what later code does with it; the flaw (or the correct
    behaviour there); how two subtasks interact; something the agent decided on its own.
  - **Not measured:** structure, names, whether someone could extend the code, long-term learning.

**Q: Is a quiz right after the task a fair measure?**

- **Say:** It's the same approach as a recent randomized study from Anthropic: developers who used AI scored 17 %
  lower on a quiz right after the task, most of all on debugging.
- **Backup:** Shen & Tamkin 2026, n = 52, mostly juniors, chat assistant rather than an agent.

**Q: Your hypothesis is about the whole feature, but the pause only shows part of the code.**

- **Say:** Exactly the interesting part. The decision is the one part you can't predict from the story, and the rest
  builds on it. If the pause at the decision also helps with questions about code that wasn't in the pause, that shows
  the decision explains the rest.
- **Backup:** The analysis splits "code seen in the pause" from "not seen". A null result would also be useful: then
  the place doesn't matter, and agents can pause anywhere.

### Exploring (right box on slide 7)

**Q: What should the pause show?**

- **Say:** Right now just the code of the subtask. Pointing at the decision ("the agent chose X") would be a stronger
  intervention, but then place and content are mixed. In this study I hold the content fixed and vary only the place.
  What the pause shows is the natural next step, especially if an LLM finds the decision point.

**Q: Isn't the pause itself a cue that says "look here"?**

- **Say:** Partly, yes, and that may even be the point: a pause at the right place directs attention there. To
  separate it from the place, every condition has exactly one pause, so the cue exists in all of them. What differs is
  only what it points at.
- **Backup:** Learning over six features is handled by counterbalancing (Williams design); position is analysed as a
  covariate.

**Q: Shouldn't familiar vs. unfamiliar language be a factor?**

- **Say:** I record TypeScript familiarity and look at it as a moderator. As a factor it would cost too much power at
  30 people, and the language would be confounded with the feature. A good candidate for a follow-up.
- **Backup:** Pre-survey item "TypeScript familiarity 1–5" exists. Within-subjects it would leave one feature per cell;
  between-subjects means 15 per group, and the interesting interaction needs far more.

**Q: What do you get from confidence vs. correctness?**

- **Say:** Whether people know what they don't know. A pause in the wrong place might raise confidence without raising
  understanding. That's measured per question with the confidence rating.

### E · Analysis and power

**Q: Are 30 people enough?**

- **Say:** It's tight. My simulation gives about 43 % power per contrast for a medium effect of 18 points, and 33 %
  for both contrasts together; at 26 points it's 79 % and 70 %. It still uses the older design; I'll rerun it with the pilot's variances. 60 people is the fallback.
- **Backup:** Mixed-effects regression, participant and feature as random effects, two planned contrasts, Holm-corrected.

**Q: Wasn't this called "milestone"?**

- **Say:** Yes, in the exposé and in the study code. For the talk I use plainer names.

### F · The landscape

**Q: How do people review agent code today?**

- **Say:** Two worlds. Background agents open a pull request, so review comes at the end, and most agent PRs get no
  human review at all. Interactive agents work plan → approve → run → diff at the end. Hardly any tool stops on purpose
  in the middle of the work. That's the gap.
- **Backup:** Duma et al. 2026; Peralta et al. 2026: 79 % of merged agent PRs show no visible feedback.

**Q: If an AI reviews the code anyway, why should a human understand it?**

- **Say:** Responsibility stays with a person. Reviewers increasingly require a known human owner before they accept
  AI pull requests. And plausible-looking agent code is exactly where problems are hard to spot.
- **Backup:** Rahman et al. 2026; Wu et al. 2026: 51 % find problems in plausible code hard to spot, 69 % say
  line-by-line review can't keep up.

---

## Weak spots: concede them openly

- **Hand-set decision points:** No second rater has checked them yet. → planned
- **Some open cases could be asked about in plan mode:** I'm checking the stories and prefer cases that only appear
  during implementation.
- **One decision point per feature is a simplification:** real code has many.
- **Power is tight at N = 30;** the simulation is still from the older design.
- **END confounds timing with amount of code:** that's why OTHER STEP exists.
- **The behaviour question could point at the decision:** a fixed rule is planned.
