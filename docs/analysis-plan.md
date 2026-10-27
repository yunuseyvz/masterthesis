# Analysis plan

What is tested, with which model, on which data. Written before any data are collected; the code is
`analysis/analyze.R`, and `docs/scenario.md` runs it on fictitious data.

There is **one research question**: does where the agent pauses affect how well people understand and judge the code?
Understanding is the primary outcome; fault detection, confidence and reversals are secondary. H1–H4 below are the
analyses of those outcomes, not four research questions.

## 1. Design and data

- **N = 30**, five per counterbalancing group (0–5), run in that order by `study-harness/scripts/run-session.sh`.
- Per person: 6 measured features, 2 per regime (BATCH, MILESTONE, NON_MILESTONE), in each regime one Correct and one
  Flawed. The practice feature (`US0`) is not analysed.
- **180 trials, 720 understanding items** (4 per trial, one per subtask). Of the items, 180 ask about the milestone
  subtask, **60 per regime**.
- Source: `exports/trials.csv`, one row per trial (columns: `docs/telemetry.md` §4).

| Counts at N = 30 | BATCH | MILESTONE | NON_MILESTONE |
|---|---|---|---|
| Trials (Correct / Flawed) | 30 / 30 | 30 / 30 | 30 / 30 |
| Milestone items | 60 | 60 | 60 |
| Flawed trials whose review contained the flaw subtask | 30 | 15 | 7 |
| Changed lines in the review | 160–390 | 29–63 | 18–86 |

## 2. Exclusions

Decided before the data are seen:

- A person who fails the attention check (pre-survey) is excluded and replaced: the next session gets the same group
  and round again (`--group`, `--round`).
- A session that does not reach Finish writes no `trials.csv` rows; the slot is re-run automatically.
- No trial-level exclusions. Times are not trimmed.

## 3. Hypotheses and models

All models: `lme4` in R, random intercepts for participant and feature; for item-level models also for the item
within its feature. `position` (1–6, centred) as a fixed effect for practice and fatigue. MILESTONE is the reference
level, so the regime coefficients are the planned contrasts directly. The two contrasts of each hypothesis are
Holm-corrected; α = .05, two-sided.

### H1 (primary): understanding of the milestone

> After a pause at the milestone, people answer the item about the milestone subtask more often correctly than after
> a review at the end (H1a) or a pause elsewhere (H1b).

Item level, binomial (logit):

```
correct ~ regime * item_type + position + (1 | participant) + (1 | feature) + (1 | feature:item)
```

`item_type` is milestone / other, with milestone as reference. Then `regimeBATCH` and `regimeNON_MILESTONE` are the
two contrasts on milestone items. Reported as odds ratios with 95 % CIs and as shares correct.

**Exploratory: the milestone, or just having looked at it?** A pause also helps the item about the paused subtask
when that subtask is not the milestone (NON_MILESTONE). `correct ~ reviewed * item_type + …` separates the
"reviewed this subtask" effect from the "milestone" effect.

### H2 (secondary): fault detection

> At a milestone pause, people tell flawed from correct code better than in the other regimes.

Signal detection as a probit model on the initial decision (before the behaviour question):

```
reject ~ regime * flawed + position + (1 | participant) + (1 | feature)
```

The `flawed` coefficient is d′ in the reference regime, `regimeX:flawed` the difference in d′; the intercept gives
the criterion c (tendency to reject). d′ per person is not estimable (one Correct and one Flawed trial per regime).

**Exposure.** The flaw lies in the milestone in three features, elsewhere in three. So the review contains the flaw
subtask in every BATCH trial, in half of the MILESTONE trials and in about a quarter of the NON_MILESTONE trials
(`flawStepReviewed`). A regime difference in d′ is therefore partly a difference in what could be seen. Reported
twice: all trials, and only trials with `flawStepReviewed` (small for NON_MILESTONE; estimates, no test). The
simulation (`docs/scenario.md` §3) shows the all-trials test finds a "difference" in 8–16 % of studies without any
real effect and misses a real one; unless the design changes, H2 is reported as exploratory.

### H3 (secondary): confidence vs. correctness

> A pause elsewhere raises confidence without raising understanding.

Per item, overconfidence = confidence (50–100) − 100 × correct. Linear mixed model with the same terms as H1
(`lmerTest`, Satterthwaite df). Also reported: mean confidence and share correct per regime × item type.

### H4 (secondary): reversals

Share of trials whose decision changed after the behaviour question, per regime × variant. A logistic mixed model
(`decisionReversed ~ regime + (1 | participant)`) only with at least 10 reversals in total; otherwise descriptive.

### Descriptive

Time before the decision (`stage1DwellMs`) and for the final review (`finalReviewMs`, medians), mental effort (Paas
1–9), share of correct final decisions, the preference ranking from the post-survey. No tests.

## 4. Covariates and robustness

No covariates in the confirmatory models. Exploratory: NCS-6, S-TIAS, programming experience and AI-assistant use
as additional fixed effects in H1.

If a model does not converge or is singular, random effects are dropped in this order: `feature:item`, `feature`.
The participant intercept always stays. Singular fits (a variance estimated as zero) are common at N = 30, because the
feature variance rests on six features; they are reported, not a reason to change the model.

## 5. Power

Estimated by simulation (`analysis/power.R`, results in `docs/scenario.md`): many fictitious studies on the real
design, each analysed exactly as above.
