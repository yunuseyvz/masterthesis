Master's thesis · Yunus Yavuz · LMU Munich

# Knowing Where to Pause: Timing a Blocking Intervention for Understanding AI-Generated Code

Timing human review of agent-written code.

[Problem](#problem)[Question](#rqs)[Subtasks](#unit)[Criterion](#milestones)[Study](#study)[Harness](#harness)[Measures](#measures)[Contributions](#contrib)[Future](#future)[Limits](#limits)[Discussion](#discuss)

## Problem

Coding agents now write whole features. Developers review the result but barely understand it.

**A review at the end** shows a large diff next to green tests, which developers treat as proof (Dhanorkar et al. 2026, [10.1145/3805689.3812402](https://doi.org/10.1145/3805689.3812402)). **Interrupting at every edit** shows half-written code and trains people to click through.

**Idea.** Pause at **semantic milestones**: moments where the agent has fixed something that matters for the feature.

## Research question

#### **RQ**Does where a coding agent pauses for review affect how well developers understand and judge the code it writes?

Compare

Milestone pause vs. a pause of similar size elsewhere; review at the end as reference.

Primary

Understanding of the finished feature.

Secondary

Fault detection, confidence vs. correctness, reversals.

## Subtasks

A coding agent works in a loop: reason, call a tool, observe, repeat. There is no natural "step". A subtask is a unit of work that serves one sub-goal and ends in a reviewable state: a plan item if the agent keeps a plan, otherwise a commit, a test run or the end of a turn. A milestone is a review gate at such a boundary.

In the study, the agent is instructed to build each feature in four subtasks.

## Semantic milestones

A milestone is a subtask that **settles a case the user story leaves open, in a decision that code still to be
written builds on**. Two things make such a moment worth a human check: the agent has decided something on the
developer's behalf without saying so, and the rest of the feature is about to rest on that decision. Once later code
builds on it, a wrong choice spreads to several files.

The criterion is judged from what a reviewer sees: the user story, the plan, the subtask's diff and the visible tests.
Synthesised from research on requirements ambiguity, developer oversight, pair programming, modularity and testing.

### Decision test

All three must hold:

1. **Open case settled.** The code handles a failure, empty, boundary or ambiguous case in one particular way; the
   story is silent on it; more than one outcome would be reasonable.
2. **Built upon.** The subtask owns the state or rule that encodes the decision, and at least one file still to be
   written calls it (tests do not count).
3. **Not yet built upon.** No downstream code exists yet.

### Example: a webhook that credits payments

Story: "The provider may deliver the same event more than once, and processing can fail temporarily."

```
export async function processWebhook(log, event, handler) {
  if (log.processed.has(event.id)) return "duplicate";
  await handler(event);
  log.processed.add(event.id);   // only AFTER the handler
  return "processed";
}
```

A crash between the two lines credits the customer twice. "Never twice, sometimes not at all" would also be
reasonable; the story does not say (open case settled). The retry loop, the endpoint and the tests will all build on
`processWebhook` (built upon), and none of them exists yet (not yet built upon).

### Why both halves

- **The open case:** models generate code directly from unclear requirements instead of asking (Mu et al. 2024,
  ClarifyGPT, FSE, [10.1145/3660810](https://doi.org/10.1145/3660810)); ambiguity degrades all evaluated models,
  which fail to localise or resolve it (Yang et al. 2026, ASE,
  [10.1145/3832783.3834403](https://doi.org/10.1145/3832783.3834403)); developers report that agents left alone fill
  decision gaps inconsistently (Dhanorkar et al. 2026, FAccT,
  [10.1145/3805689.3812402](https://doi.org/10.1145/3805689.3812402)); pairs have to re-synchronise their
  understanding actively (Zieris & Prechelt 2016, ICSE Companion,
  [10.1145/2889160.2889249](https://doi.org/10.1145/2889160.2889249)).
- **Built upon, not yet:** LLM code looks modular but creates hidden dependencies between modules (Kravchuk-Kirilyuk
  et al. 2025, LMPL, [10.1145/3759425.3763392](https://doi.org/10.1145/3759425.3763392)); more capable models
  generate more coupled code (Zhu et al. 2026, [arXiv:2605.02741](https://arxiv.org/abs/2605.02741)); reviewers want
  cohesive sub-changes and their rationale (Tao et al. 2012, FSE,
  [10.1145/2393596.2393656](https://doi.org/10.1145/2393596.2393656)); interruptions are cheaper at subtask
  boundaries (Iqbal & Bailey 2006, CHI, [10.1145/1124772.1124882](https://doi.org/10.1145/1124772.1124882)).

An earlier version had three separate criteria. In the study material the open case never occurred without the
dependency, and a third criterion (a **test blind spot**: the code distinguishes more kinds of input than the visible
tests exercise) cannot occur at a pause, since the agent writes its tests in the last subtask. The two that occur
were therefore fused; the test blind spot remains a reason for review outside this study.

## Study design

Within-participants online study, 30 people, \~60 minutes; the first sessions are moderated over a video call. Six features, two per condition: one correct, one with a flaw. Six counterbalancing groups of five people (Williams design): across the groups every feature appears in every condition, and the order is balanced for carry-over.

### BATCH

Review once at the end, the whole feature (about 160–390 changed lines).

**review**

### MILESTONE

Pause after the subtask chosen as the milestone (about 29–63 changed lines).

**review**

### NON-MILESTONE

Pause after one of the two other subtasks among 1–3 (about 18–86 changed lines). Each is used equally often per feature.

**review**

### Procedure

**Onboarding**Consent, demographics, practice feature.

**Review**Accept or reject, then one behaviour question answered by running the code. Same in all conditions. After a rejection the agent asks what to change and fixes it.

**After**Five understanding questions, each with a confidence rating: how the milestone settled its open case, what later code relies on in it, what the flaw changes, how two subtasks work together, and one decision the agent made on its own. Then one mental-effort item (Paas, 1–9).

**End**Preference, debrief.

### Materials

- **Corpus:** six features in a Next.js shop, four subtasks each.
- **Flaws:** in the Flawed variant, the agent's instructions contain one plausible but wrong design decision that contradicts one acceptance criterion of the user story; the agent's own tests do not catch it. Half in the milestone subtask, half elsewhere.
- **Milestones:** one per feature, two each at subtask 1, 2 and 3, so position is no cue. In the author's reading, every milestone meets the criterion; a second rater checks this. The criterion justifies where the milestone is; it is not a factor of the study.

| Feature | Milestone | Open case it settles | Flaw in | The wrong decision |
| --- | --- | --- | --- | --- |
| US1 Flash-sale reservation | 2 Stock reservation | an order for more than is left | 2 | sold-out items are removed: 404 instead of 409 |
| US2 Payment webhook | 3 Deduplication and retry | a redelivery of an event that was given up | 2 | cents by rounding down: "19.99" credits 1998 |
| US3 Tenant configuration | 2 Defaults merged with overrides | a limit set to `null` | 3 | a bulk operation counts as one against the quota |
| US4 SLA credits | 1 Duration parsing, time helpers | a duration without a unit | 3 | outages crossing the billing period are skipped |
| US5 Rate limiter | 3 Sliding-window check | a request exactly one window after the oldest | 3 | rejected requests count: a retrying client stays blocked |
| US6 Coupons | 1 Discount calculation | a discount of a fraction of a cent | 1 | a 100 % coupon is refused |
- **Questions:** decision-awareness items, checked by running the code. The item about the milestone's open case is the milestone item; the flaw is a separate decision in its subtask and has an item of its own.
- **Agent:** a real model (DeepSeek V4.1 Flash) in opencode, following hidden instructions per feature: the subtasks, their design decisions, and a review checkpoint to call after each of subtasks 1–3. The study decides at the checkpoint whether the agent waits. The plan the participant approves is a fixed text per feature, written by the study: it names the subtasks and leaves the decisions out, so it is the same for the correct and the flawed variant. Answers are graded on the code the agent actually wrote. Line counts above are from a reference implementation; the agent's code varies.

## The study harness

**Live demo:** [lh5r2nttxqpkpw7comjsvftk.yuemya.de](https://lh5r2nttxqpkpw7comjsvftk.yuemya.de/), a demo deployment for clicking through.

Screenshots from a test session.

Review at the end (BATCH). The agent has written all four subtasks. The plan shows its progress, the Changes pane shows every file, and the participant decides below.

Pause at the milestone (MILESTONE), here after subtask 3. Only the core logic is up for review. The plan shows that one subtask is still open.

Behaviour question at the review: answered by running the code, before the decision is confirmed or reversed.

Preview: a small browser on the running app. The Terminal tab is a real shell where `npm test` and `npm run dev` work.

After each feature: five understanding questions, each with a confidence rating. The code panes are closed.

## Measures and analysis

| Role | Measure | What is compared |
| --- | --- | --- |
| Primary | Understanding of the finished feature | Share of correct answers per condition, milestone questions vs. the rest |
| Secondary | Fault detection | How well people tell flawed from correct code, separate from how often they reject in general; also only for reviews that contained the flaw subtask |
| Secondary | Confidence vs. correctness | How far confidence exceeds actual correctness, per condition |
| Secondary | Reversals | How often people change their decision after the behaviour question |
| Descriptive | Time, mental effort | Compared by condition, no hypothesis |

Expected: a milestone pause closes the understanding gap on milestone decisions; a pause elsewhere does not, and may raise confidence without raising understanding.

Analysis: mixed-effects regressions with participant and feature as random effects, planned contrasts MILESTONE vs. BATCH and MILESTONE vs. NON-MILESTONE, Holm-corrected. Details and a simulated run with fictitious data: `docs/study/analysis-plan.md`, `docs/study/scenario.md`.

## Contributions

- A pause criterion with a decision test.
- A controlled comparison of where to pause.
- A reproducible study harness.

## Future work: finding milestones automatically

A **parallel reviewer** runs next to the agent and decides when to stop for a human.

- **System One model** (e.g. TypeSafe Jev): answers the criterion's yes/no tests fast and cheap; its probability sets how often to interrupt.
- **LLM as judge:** slower, but can name the silent decision and turn it into the review prompt.
- **Combined:** System One screens everything, the judge checks what it flags.

### Invisible pauses

The agent pauses every few tool calls; the reviewer checks the diff since the last checkpoint and either stops the agent or lets it continue.

Evaluation needs ground truth beyond the author's labels: multiple raters, real user interventions, or study outcomes. Risk: developers may trust a quiet reviewer like they trust green tests.

## Limits

- Participants may not perceive a difference between a milestone and a non-milestone pause.
- The author places the milestones; no second person has checked them.
- A real but instructed agent: its code varies between sessions, and a flaw it is told to make may not land (checked per trial). Small project, a small sample.
- A pause shows a fifth to a sixth of the code a review at the end shows, so timing and amount of code are confounded for BATCH. MILESTONE and NON-MILESTONE are of similar size.
- One fused criterion: the study cannot say whether the open case or the dependency matters more.

## Open points for discussion

- **Conditions**
- **Measuring understanding:** which instrument, grounded in which literature?
- **Automatic detection:** how much of it belongs in the thesis?
- **Sample size:** 30 people; is that enough (see the simulation in `docs/study/scenario.md`)?