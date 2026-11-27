# Analysis plan

What is tested, with which model, on which data. Written before any data are collected; the code is
`analysis/analyze.R`, and `analysis/simulate.R` runs it on fictitious data.

There is **one research question**: does where the agent pauses affect how well people understand and judge the code?
Understanding of the feature is the primary outcome (H1), understanding of the milestone's decision says why (H2);
fault detection, confidence and reversals are secondary (H3–H5). They are the analyses of those outcomes, not five
research questions.

## 1. Design and data

- **N is not fixed:** as many people as the thesis allows, about 30 planned. Sessions run in group order (0–5): locally
  `study-harness/scripts/run-session.sh` picks the next group, and online Conditioner gives a new participant the
  group with the fewest participants who count; the round alternates within each group
  (`study-harness/deploy/make-conditions.mjs`). So at any N the six groups differ by at most one person, except for a
  short time after a dropout, until the next participant takes their place; the mixed models do not need equal groups. The N reached and the power at it are reported as a limitation. Counts below are for
  N = 30.
- Per person: 6 measured features, 2 per regime (BATCH, MILESTONE, NON_MILESTONE), in each regime one Correct and one
  Flawed. The practice feature (`US0`) is not analysed.
- **180 trials, 900 understanding items** (5 per trial, one per role: open case, dependency, flaw, interplay,
  emergent; `shared/src/schema.ts`, `ItemRole`), **300 per regime**. The open-case item is the milestone item: 180,
  **60 per regime**.
- Source: `exports/trials.csv`, one row per trial (columns: `CSV_COLUMNS` in `study-harness/server/src/export.ts`, see `docs/data.md`).

| Counts at N = 30 | BATCH | MILESTONE | NON_MILESTONE |
|---|---|---|---|
| Trials (Correct / Flawed) | 30 / 30 | 30 / 30 | 30 / 30 |
| Understanding items (all / milestone) | 300 / 60 | 300 / 60 | 300 / 60 |
| Flawed trials whose review contained the flaw subtask | 30 | 15 | 15 |
| Changed lines in the review (reference code) | 162–392 | 29–63 | 18–88 |

NON_MILESTONE never pauses after a declarative subtask (types and constants only, `declarative` in `trial.json`), so
in five features its pause step is fixed and only US1 has two candidates (`docs/stimuli.md`).

## 2. Exclusions

Decided before the data are seen:

- **When data collection ends** does not depend on the results: it ends when the thesis schedule or the supply of
  participants ends. The hypotheses are analysed once, after that. During data collection only exclusions and
  technical faults are checked (`featureComplete`, `pauseMissed`, the attention check), never the outcomes, since
  stopping when a result looks good would raise the false-positive rate.
- A person who fails the attention check (pre-survey) is excluded and replaced: locally the next session gets the same
  group and round again (`--group`, `--round`); online they are excluded on Conditioner's dashboard (the data
  stay), and the next participant takes their place.
- A session that does not reach Finish writes no `trials.csv` rows, and it is replaced: locally it is re-run, online
  a participant whose pod stopped before the debrief no longer counts, so the next one takes their place. Nobody plays twice: a pod started again
  shows only the end (`session_refused`). This includes a session the server ends because nobody is there (`session_abandoned`: 10 min without input, then 10 min without an
  answer to "Are you still there?", or 120 min in total). A session that ends this way at the debrief is complete and is
  exported as after Finish.
- Two trial-level exclusions, both about the condition actually played: a trial whose feature the agent left
  unfinished (`featureComplete` false), and a pause regime whose pause the agent never reached (`pauseMissed` true;
  the review then came at the end of its turn). The harness reminds the agent twice, hidden from the participant,
  before it gives up. Excluded trials are reported per regime. Times are not trimmed.
- Every answer is graded on the code as played. When an item's script prints no answer on that code (the agent built
  something the script cannot run), the answer is **missing, not wrong**: left out of the item-level models and
  counted per regime. Trials whose reviewed step was accepted after failing its check twice (`pauseStepForced`) stay
  in and are counted per regime.

## 3. Hypotheses and models

All models: `lme4` in R, random intercepts for participant and feature; for item-level models also for the item
within its feature. `position` (1–6, centred) as a fixed effect for practice and fatigue. MILESTONE is the reference
level, so the regime coefficients are the planned contrasts directly. The two contrasts of each hypothesis are
Holm-corrected; α = .05, two-sided.

**What the two contrasts say.** MILESTONE vs. NON_MILESTONE carries the claim about the decision point: both pause
once, partway, after one subtask of similar size (29–63 vs. 18–88 changed lines), and differ in which subtask. MILESTONE
vs. BATCH only answers "a pause partway vs. a review at the end": there the place and the amount of code (one subtask
vs. all four, 162–392 lines) change together. Both stay planned and are reported; a difference against BATCH alone does
not show that the milestone is the better place.

### H1 (primary): understanding of the feature

> After a pause at the milestone, people answer the understanding items of the feature more often correctly than
> after a review at the end (H1a) or a pause elsewhere (H1b).

Item level, all five items, binomial (logit):

```
correct ~ regime + position + (1 | participant) + (1 | feature) + (1 | feature:item)
```

`regimeBATCH` and `regimeNON_MILESTONE` are the two contrasts. Reported as odds ratios with 95 % CIs and as shares
correct.

**Sensitivity: without the flaw item.** BATCH asks its behaviour question about the flaw subtask, and in some features
that question is close to the flaw item asked later (US2, US4, US6 kept theirs; `docs/stimuli.md`). The same
model without the flaw items (four per trial) shows whether H1 depends on that practice.

**Sensitivity: without adapted items.** Where the code as played did something no option said, that outcome replaced a
wrong option (`uK_adapted`). The same model without those items.

**Sensitivity: beyond the paused step.** MILESTONE pauses after the step that decides 14 of the 30 items,
NON_MILESTONE after one that decides 10 on average (`uK_step`). A pause, with its behaviour question, may help the
items about the step it follows whatever that step is, so H1b could come from where the items lie alone. On the two
pause regimes only:

```
correct ~ regime + reviewed + position + (1 | participant) + (1 | feature) + (1 | feature:item)
```

`reviewed` is 1 when the pause followed the item's step. The regime coefficient is H1b beyond that; reported next to
H1b, not Holm-corrected.

**Equivalence.** The smallest difference that matters is 5 points of share correct (`SESOI_POINTS` in `analyze.R`),
fixed before data. For each H1 contrast, two one-sided tests: the contrast is equivalent when its 90 % CI lies within
±5 points, turned into log-odds at MILESTONE's share correct for a typical participant and item (the model's
intercept). A non-significant H1b is read as "no difference that matters" only if it is equivalent, otherwise as
inconclusive. At N = 24–36 the test cannot succeed (§5), so in practice it marks a null H1b as inconclusive.

What can dilute H1: every regime ends with a final look at the whole feature (without a decision), and a NON_MILESTONE
pause can show the code of the dependency item (usually written after the milestone), which a MILESTONE pause never
shows. H1 then rests on the milestone pause
helping beyond the code it shows.

### H2: understanding of the milestone

> After a pause at the milestone, people answer the milestone item (how the milestone settled the case the story
> leaves open) more often correctly than after a review at the end (H2a) or a pause elsewhere (H2b).

Planned like H1, on the same items:

```
correct ~ regime * item_type + position + (1 | participant) + (1 | feature) + (1 | feature:item)
```

`item_type` is milestone / other, with milestone as reference. Then `regimeBATCH` and `regimeNON_MILESTONE` are the
two contrasts on milestone items. H2 is the reason for H1: the milestone's decision is what a pause there shows and a
review elsewhere does not.

**Exploratory: the milestone, or just having looked at it?** A pause also helps an item about the paused subtask
when that subtask is not the milestone (NON_MILESTONE). An item's subtask is the one whose code decides its answer
(`uK_step`). `correct ~ reviewed * item_type + …` separates the "reviewed this subtask" effect from the "milestone"
effect, on the items of the two pause regimes: BATCH has no pause, and its items would count as not reviewed although
its review showed every step.

**Exploratory: what builds on the milestone.** The dependency item asks what later code relies on in the milestone's
decision. The code that decides its answer is usually written after the milestone, so a NON_MILESTONE pause after that
subtask shows it, and a MILESTONE pause cannot. Reported as shares correct per regime and role, and as
`correct ~ regime + position + (1 | participant) + (1 | feature)` on the dependency items alone.

### H3 (secondary): fault detection

> At a milestone pause, people tell flawed from correct code better than in the other regimes.

Signal detection as a probit model on the initial decision (before the behaviour question):

```
reject ~ regime * flawed + flawed:flaw_position + position + (1 | participant) + (1 | feature)
```

The `flawed` coefficient is d′ in the reference regime, `regimeX:flawed` the difference in d′; the intercept gives
the criterion c (tendency to reject). d′ per person is not estimable (one Correct and one Flawed trial per regime).

**The flaw as played.** `flawed` is whether the code under review had the flaw at that decision (`flawAtDecision`,
from the flaw step's behaviour question, whose answers differ between the variants): the agent may not write a flaw it
was told to, or make the wrong decision unasked in a Correct trial. Where the flaw step was not written yet, the
decision could not depend on it, and the assigned variant stands; trials where the code does something else
(`unknown`) are left out. Sensitivity: the same model on the assigned variant. Reported with it, per variant: the flaw
at the decision and in the graded code (`flawAtEnd`), and the share of trials whose open case came out as scripted
(`openCaseAsScripted`).

**Where the flaw lies relative to the pause** (`flaw_position`, from `flawStep` and `pauseStep`): in the review (the
paused subtask, or BATCH, which shows all of them), written before the pause (in the files, not in the review), or not
written yet. The flaw lies in the milestone in three features and in the NON_MILESTONE pause in three others, so the
review contains it in every BATCH trial and in half of the MILESTONE and NON_MILESTONE trials:

| Flaw subtask at N = 30 (trials) | in the review | before the pause | not yet written |
|---|---|---|---|
| BATCH | 60 | – | – |
| MILESTONE | 30 | 10 (US2) | 20 (US3, US4) |
| NON_MILESTONE | 30 | 15 (US1 round 1, US6) | 15 (US1 round 0, US5) |

`flawed:flaw_position` takes out what could not be seen, so `regimeX:flawed` compares d′ when the flaw subtask was in
the review. Against BATCH that still differs in the amount of code (one subtask vs. all four). Also reported: d′ per
regime on only the trials with `flawStepReviewed`.

**Exploratory.** The simulation (`analysis/scenario/power.txt`) finds the assumed d′ differences in 2–7 % of studies
at N = 24–36, so H3 is reported as estimates with 95 % CIs and not counted as a test. Without an effect, the covariate
keeps the false positives at the nominal 5 % (without it, MILESTONE vs. BATCH: 8–16 %).

### H4 (secondary): confidence vs. correctness

> A pause elsewhere raises confidence without raising understanding.

Per item, overconfidence = confidence − 100 × correct. Confidence runs from 25 % to 100 % (25, 40, 55, 70, 85, 100):
with four options per item 25 % is guessing, so someone who guesses and says so scores about 0. Linear mixed model with
the same terms as H2 (`lmerTest`, Satterthwaite df). Also reported: mean confidence and share correct per regime × item
type.

**Exploratory: calibration beyond the mean.** Overconfidence only shows the level of confidence, not whether people know
when they have not understood something. Per regime: the Brier score and the resolution (AUROC of confidence for a
correct answer, pooled over people).

### H5 (secondary): reversals

Share of trials whose decision changed after the behaviour question, per regime × variant. A logistic mixed model
(`decisionReversed ~ regime + (1 | participant)`) only with at least 10 reversals in total; otherwise descriptive.

### Descriptive

Time before the decision (`stage1DwellMs`) and for the final review (`finalReviewMs`, medians), mental effort (Paas
1–9), the three statements about each feature's review (`pauseTiming`, `pauseHelped`, `pauseDisrupted`, 1–7; means
per regime), share of correct final decisions, the preference ranking from the post-survey. No tests.

## 4. Covariates and robustness

No covariates in the confirmatory models. Exploratory: NCS-6, S-TIAS, programming experience and AI-assistant use
as additional fixed effects in H1 and H2.

If a model does not converge or is singular, random effects are dropped in this order: `feature:item`, `feature`.
The participant intercept always stays. Singular fits (a variance estimated as zero) are common at N ≈ 30, because the
feature variance rests on six features; they are reported, not a reason to change the model.

## 5. Power

Estimated by simulation (`analysis/power.R`, results in `analysis/scenario/power.txt`): many fictitious studies on the
real design, each analysed exactly as above. With an assumed +9 / +7 points on all items (MILESTONE vs. BATCH /
NON_MILESTONE) and +16 on the milestone item, N = 30 finds H1a in 67 %, H1b in 51 %, H2 in about 45 % of studies;
N = 36 in 78 %, 57 % and about 57 %; N = 24 in 51 %, 38 % and about 35 %. 80 % power for H1b needs about +12 points, for H2 about +24. The assumptions are
guesses until the pilot; rerun with its variances.

**Where the items lie.** In the scenario `reviewed only` a pause helps the items about the step it follows (+0.3
log-odds) and the milestone nothing beyond that. There H1b comes out significant in 2–6 % of studies (N = 24–36), so
the placement of the items barely inflates it; H1a and H2 (both contrasts) in 6–11 %. H1b beyond the paused step has
43 % power at N = 30 (medium), and 4–8 % false positives.

**Equivalence.** The equivalence test (±5 points) succeeds in none of the simulated studies at N = 24–36, not even
without any effect: the 90 % CI of H1b spans about ±0.3 log-odds (about ±7 points), wider than the bounds. A
non-significant H1b therefore stays inconclusive at this N; the test keeps it from being read as "no effect".
Showing equivalence at ±5 points would take roughly five times as many participants (from the width of the CI, not
simulated).
