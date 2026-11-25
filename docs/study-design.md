# Study design

Does where a coding agent pauses for review affect how well developers understand and judge the code it writes?

## Milestones

The agent builds each feature in four subtasks. A **milestone** is a subtask that settles a case the user story
leaves open, in a decision that code still to be written builds on. All three must hold:

1. **Open case settled.** The code handles a failure, empty, boundary or ambiguous case in one particular way; the
   story is silent on it; more than one outcome would be reasonable.
2. **Built upon.** The subtask owns the state or rule that encodes the decision, and at least one file still to be
   written calls it (tests do not count).
3. **Not yet built upon.** No downstream code exists yet.

Example: a webhook handler that records an event as processed only after the handler ran. A crash in between credits
the customer twice; "never twice, sometimes not at all" would be just as reasonable, and the story does not say. The
retry loop, the endpoint and the tests will all build on it, and none exists yet.

## Design

Within-participants, online, about 60 minutes, about 30 participants (not fixed; at most 36). Six features, two per
condition, one correct and one with a flaw. Six counterbalancing groups (Williams design) filled in turn.

| Condition | Review |
|---|---|
| BATCH | Once at the end, the whole feature (about 160–390 changed lines) |
| MILESTONE | After the milestone subtask (about 29–63 lines) |
| NON-MILESTONE | After another subtask with behaviour of its own (about 18–88 lines) |

Per feature: accept or reject, then a behaviour question answered by running the code, then five understanding
questions with a confidence rating (open case, dependency, flaw, interplay, one emergent decision), a mental-effort
item (Paas, 1–9) and three statements about the review (1–7).

## Materials

- **Corpus:** six features in a small Next.js shop (`study-harness/project`), plus a practice feature (US0). How they
  are made: [stimuli.md](stimuli.md).
- **Flaw:** in the Flawed variant the agent's hidden instructions contain one plausible but wrong design decision that
  contradicts a criterion of the story; the agent's own tests do not catch it.
- **Plan:** a fixed public text per feature that names the subtasks but not the decisions, so it is identical in both
  variants.
- **Agent:** a real model (DeepSeek V4.1 Flash) in opencode, following a hidden script per feature. Answers are graded
  on the code the agent actually wrote.

| Feature | Milestone | Open case it settles | Flaw in | The wrong decision |
|---|---|---|---|---|
| US1 Flash-sale reservation | 2 | an order for more than is left | 2 | sold-out items are removed: 404 instead of 409 |
| US2 Payment notifications | 3 | a repeated delivery of an event that was given up | 2 | cents by rounding down: "19.99" credits 1998 |
| US3 Seller settings | 2 | a limit set to `null` | 3 | a bulk operation counts as one against the limit |
| US4 Outage refunds | 1 | a duration without a unit | 3 | outages crossing the billing month are skipped |
| US5 Request limit | 3 | a request exactly one window after the oldest | 3 | rejected requests count: a retrying client stays blocked |
| US6 Coupons | 1 | a discount of a fraction of a cent | 1 | a 100 % coupon is refused |

## Hypotheses and analysis

Mixed-effects models (`lme4`) with random intercepts for participant and feature, `position` as a covariate, MILESTONE
as the reference level; the full plan is [analysis-plan.md](analysis-plan.md). The planned contrasts are MILESTONE vs. BATCH and MILESTONE vs. NON-MILESTONE, Holm-corrected,
α = .05. MILESTONE vs. NON-MILESTONE carries the claim about the place; MILESTONE vs. BATCH changes place and amount of
code together. The code is `analysis/analyze.R`.

| | Outcome | Model |
|---|---|---|
| H1 | Understanding of the feature (all five items) | logistic, item level; also without the flaw item |
| H2 | Understanding of the milestone item | as H1, with item type |
| H3 | Fault detection | probit signal detection on the first decision, with the flaw's position relative to the review; exploratory |
| H4 | Confidence vs. correctness | linear, confidence minus 100 × correct |
| H5 | Reversals | logistic if at least 10 reversals, otherwise descriptive |

Descriptive only: time, mental effort, the three statements, preference.

**Exclusions** (fixed before data collection): failed attention check (replaced); sessions that do not reach Finish
(slot re-run); trials where the agent left the feature unfinished or never reached the pause. Data collection ends by
schedule, not by results; the hypotheses are analysed once.

**Power**, by simulation (`analysis/power.R`): with +9 / +7 points on all items and +16 on the milestone item,
N = 30 finds H1a in 67 %, H1b in 51 % and H2 in about 45 % of studies. The assumptions are guesses until the pilot.

## Limits

- Participants may not perceive a difference between a milestone and a non-milestone pause.
- The author placed the milestones; a second rater has not checked them.
- The agent is real but instructed: its code varies, and a flaw it is told to make may not land (checked per trial).
- A pause shows a fifth to a sixth of the code a final review shows, so timing and amount are confounded for BATCH.
- One fused criterion: the study cannot say whether the open case or the dependency matters more.
