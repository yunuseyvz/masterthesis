Master's thesis · Yunus Yavuz · LMU Munich

# Interventions in Agentic Coding

Timing human review of agent-written code.

[Problem](#problem)[Question](#rqs)[Subtasks](#unit)[Criteria](#milestones)[Study](#study)[Harness](#harness)[Measures](#measures)[Contributions](#contrib)[Future](#future)[Limits](#limits)[Discussion](#discuss)

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

In the study, each feature is scripted as four subtasks.

## Semantic milestones (C1 to C3)

Synthesised from research on requirements ambiguity, developer oversight, pair programming, modularity and testing. Each has a decision test.

C1

## Unspecified case

The agent has to do something on a failure, an empty input or a boundary input. The story does not say what. It picks an answer and does not mention it.

### Rules

1. The code handles a failure, empty or boundary case differently from the normal case.
2. The story is silent on it.
3. More than one outcome would be reasonable.

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

A crash between the two lines credits the customer twice. "Never twice, sometimes not at all" would also be reasonable; the story does not say.

Literature (4)

- Mu et al. 2024, ClarifyGPT, FSE. LLMs generate code directly from unclear requirements instead of asking. [10.1145/3660810](https://doi.org/10.1145/3660810)
- Yang et al. 2026, ASE. 1,304 tasks: ambiguity degrades all evaluated models; they flag ambiguity with high recall but low precision, and fail to localise or resolve it. [10.1145/3832783.3834403](https://doi.org/10.1145/3832783.3834403)
- Dhanorkar et al. 2026, FAccT. Developers report that agents left alone fail to fill decision gaps consistently, so they plan with the agent first. [10.1145/3805689.3812402](https://doi.org/10.1145/3805689.3812402)
- Zieris & Prechelt 2016, ICSE Companion. Pairs have to actively re-synchronise their understanding; equal grasp does not guarantee common understanding. [10.1145/2889160.2889249](https://doi.org/10.1145/2889160.2889249)

C2

## Foundation fixed

The subtask defines state or a rule, and code that is still to be written calls it. If it is only checked later, several files have to be corrected at once.

### Rules

1. The subtask owns state or a rule.
2. At least one file still to be written calls it (tests do not count).
3. No downstream code exists yet.

### Example: account balance

```
export function createLedger() {
  return { balances: new Map<string, number>() };   // amounts in cents
}
export function credit(ledger, accountId, cents) {
  const old = ledger.balances.get(accountId) ?? 0;
  ledger.balances.set(accountId, old + cents);
}
```

Handler, API and tests will all build on `credit` and cents. A wrong choice spreads to all of them.

Literature (2)

- Kravchuk-Kirilyuk et al. 2025, LMPL workshop. LLM code often looks modular but creates hidden dependencies between modules and struggles to stay consistent across files. [10.1145/3759425.3763392](https://doi.org/10.1145/3759425.3763392)
- Zhu et al. 2026, preprint. As models get more capable, the code they and agents generate becomes more bloated and coupled; correct code and detailed prompts do not prevent this. [arXiv:2605.02741](https://arxiv.org/abs/2605.02741)

C3

## Test blind spot

The code distinguishes more kinds of input than the visible tests exercise. Green tests then give false confidence.

### Rules

1. The code distinguishes at least three kinds of input.
2. The visible tests exercise fewer.

### Example: discount code

```
export function applyDiscount(code, subtotal) {
  if (code === "NONE") return subtotal;                       // kind 1
  if (code.endsWith("%")) return subtotal * (1 - parseInt(code) / 100);  // kind 2
  return Math.max(0, subtotal - Number(code));                // kind 3: fixed amount

// test: applyDiscount("10%", 200) === 180     <- covers only kind 2
```

Tests are green, but two of three branches never ran.

Literature (2)

- Dhanorkar et al. 2026, FAccT. Developers treat passing tests as a guarantee. [10.1145/3805689.3812402](https://doi.org/10.1145/3805689.3812402)
- Inozemtseva & Holmes 2014, ICSE. Coverage is only weakly to moderately correlated with how well a test suite finds faults once its size is controlled. [10.1145/2568225.2568271](https://doi.org/10.1145/2568225.2568271)

## Study design

Within-participants lab study, 30 people, \~60 minutes. Six features, two per condition: one correct, one with a seeded flaw. Six counterbalancing groups of five people (Williams design): across the groups every feature appears in every condition, and the order is balanced for carry-over.

### BATCH

Review once at the end, the whole feature (160–390 changed lines).

**review**

### MILESTONE

Pause after the subtask chosen as the milestone (29–63 changed lines).

**review**

### NON-MILESTONE

Pause after one of the two other subtasks among 1–3 (18–86 changed lines). Each is used equally often per feature.

**review**

### Procedure

**Onboarding**Consent, demographics, practice feature.

**Review**Accept or reject, then one behaviour question answered by running the code. Same in all conditions.

**After**One understanding question per subtask, each with a confidence rating, then one mental-effort item (Paas, 1–9).

**End**Preference, debrief.

### Materials

- **Corpus:** six features in a Next.js shop, four subtasks each.
- **Flaws:** invisible to the tests; half in the milestone subtask, half elsewhere.
- **Milestones:** one per feature, two each at subtask 1, 2 and 3, so position is no cue. In the author's reading, every milestone meets C2, five also meet C1, none meets C3. The criteria justify the choice and are reported descriptively, they are not a factor of the study.

| Feature | Milestone | Criteria | Flaw in |
| --- | --- | --- | --- |
| US1 Flash-sale reservation | 2 Stock reservation | C2, C1 (failed reservation) | 2 |
| US2 Payment webhook | 3 Deduplication and retry | C2, C1 (failure between credit and log) | 2 |
| US3 Tenant configuration | 2 Defaults merged with overrides | C2 | 3 |
| US4 SLA credits | 1 Duration parsing, time helpers | C2, C1 (malformed durations) | 3 |
| US5 Rate limiter | 3 Sliding-window check | C2, C1 (whether rejected requests count) | 3 |
| US6 Coupons | 1 Discount calculation | C2, C1 (discount above the amount) | 1 |
- **Questions:** decision-awareness items, coded as milestone or not, checked by running the code.
- **Agent:** scripted, but looks like a real agent session.

## The study harness

**Live demo:** [lh5r2nttxqpkpw7comjsvftk.yuemya.de](https://lh5r2nttxqpkpw7comjsvftk.yuemya.de/), a demo deployment for clicking through.

Screenshots from a test session.

Review at the end (BATCH). The agent has written all four subtasks. The plan shows its progress, the Changes pane shows every file, and the participant decides below.

Pause at the milestone (MILESTONE), here after subtask 3. Only the core logic is up for review. The plan shows that one subtask is still open.

Behaviour question at the review: answered by running the code, before the decision is confirmed or reversed.

Preview: a small browser on the running app. The Terminal tab is a real shell where `npm test` and `npm run dev` work.

After each feature: one understanding question per subtask, each with a confidence rating. The code panes are closed.

## Measures and analysis

| Role | Measure | What is compared |
| --- | --- | --- |
| Primary | Understanding of the finished feature | Share of correct answers per condition, milestone questions vs. the rest |
| Secondary | Fault detection | How well people tell flawed from correct code, separate from how often they reject in general; also only for reviews that contained the flaw subtask |
| Secondary | Confidence vs. correctness | How far confidence exceeds actual correctness, per condition |
| Secondary | Reversals | How often people change their decision after the behaviour question |
| Descriptive | Time, mental effort | Compared by condition, no hypothesis |

Expected: a milestone pause closes the understanding gap on milestone decisions; a pause elsewhere does not, and may raise confidence without raising understanding.

Analysis: mixed-effects regressions with participant and feature as random effects, planned contrasts MILESTONE vs. BATCH and MILESTONE vs. NON-MILESTONE, Holm-corrected. Details and a simulated run with fictitious data: `docs/analysis-plan.md`, `docs/scenario.md`.

## Contributions

- Pause criteria with decision tests.
- A controlled comparison of where to pause.
- A reproducible study harness.

## Future work: finding milestones automatically

A **parallel reviewer** runs next to the agent and decides when to stop for a human.

- **System One model** (e.g. TypeSafe Jev): answers the C1–C3 yes/no tests fast and cheap; its probability sets how often to interrupt.
- **LLM as judge:** slower, but can name the silent decision and turn it into the review prompt.
- **Combined:** System One screens everything, the judge checks what it flags.

### Invisible pauses

The agent pauses every few tool calls; the reviewer checks the diff since the last checkpoint and either stops the agent or lets it continue.

Evaluation needs ground truth beyond the author's labels: multiple raters, real user interventions, or study outcomes. Risk: developers may trust a quiet reviewer like they trust green tests.

## Limits

- Participants may not perceive a difference between a milestone and a non-milestone pause.
- The author places the milestones; no second person has checked them.
- Scripted agent, small project, lab participants.
- A pause shows a fifth to a sixth of the code a review at the end shows, so timing and amount of code are confounded for BATCH. MILESTONE and NON-MILESTONE are of similar size.
- With six features, each milestone criterion is tied to one or two features; the study cannot compare criteria.

## Open points for discussion

- **Conditions**
- **Measuring understanding:** which instrument, grounded in which literature?
- **Automatic detection:** how much of it belongs in the thesis?
- **Sample size:** 30 people; is that enough (see the simulation in `docs/scenario.md`)?