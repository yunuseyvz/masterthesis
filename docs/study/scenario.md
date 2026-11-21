# A fictitious study

A dry run of the study before it happens: what one person goes through and what data that produces (§1), a whole
study of 30 people analysed as planned (§2), and how often a study of 24–36 people would find the effect at all (§3).
**All numbers here are invented.** They come from assumed effects, not from people.

Reproduce:

```
npx tsx analysis/design.ts 30 > analysis/scenario/design.csv        # the real design: groups, rounds, pause steps
Rscript analysis/simulate.R analysis/scenario/design.csv analysis/scenario/trials.csv 7
Rscript analysis/analyze.R analysis/scenario/trials.csv              # the planned analysis (docs/study/analysis-plan.md)
Rscript analysis/power.R 250 24,30,36                                # §3, about 45 minutes on 4 cores
```

## 1. One person: P07

P07 is the seventh person to come in. Six sessions are finished in `exports/` before them, so `run-session.sh` gives
group 0 (6 mod 6) and round 1 (one earlier group-0 session, P01's). Group 0
fixes the order and conditions; round 1 makes their NON_MILESTONE pauses the other candidate subtask than P01's.

**Before (≈ 8 min).** Consent, demographics, NCS-6 with the attention check, S-TIAS. Then the practice feature
(`US0`, greeting formatter): plan, approve, pause after subtask 2, accept, behaviour question, the rest, five
understanding questions. Nothing of it is analysed.

**Six features (≈ 7 min each).**

| # | Feature | Condition | What P07 reviews before deciding | Decision (→ after the behaviour question) | Understanding |
|---|---|---|---|---|---|
| 1 | US1 Flash-sale reservation | BATCH · correct | all four subtasks, 162 lines | accept | 5/5 |
| 2 | US2 Payment webhook | MILESTONE · correct | subtask 3, deduplication and retry | accept | 4/5 |
| 3 | US6 Coupons | NON_MILESTONE · **flawed** | subtask 3, the order summary; the flaw is in subtask 1 | reject | 4/5 |
| 4 | US3 Tenant configuration | NON_MILESTONE · correct | subtask 3, the quota checks | accept | 4/5 |
| 5 | US5 Rate limiter | MILESTONE · **flawed** | subtask 3, the sliding-window check, with the flaw in it | reject | 4/5 |
| 6 | US4 SLA credits | BATCH · **flawed** | all four subtasks, 359 lines | accept → **reject** | 4/5 |

Things to notice:

- In trial 3 P07 rejects flawed code without the flaw being in the review. Right decision, but not from having seen
  the flaw; `flawStepReviewed = false` marks this.
- In trial 6 the behaviour question asks about the flaw subtask (BATCH always does), and running the code changes
  the decision. That is one reversal.
- All five items per feature count for H1: the milestone item (the case its milestone settled), what builds on the
  milestone, the flaw, how two subtasks work together, and a decision the agent made on its own. P07 gets 25 of 30
  right. The six milestone items alone are H2; P07 gets all six right, with 55 % to 85 % confidence.

After each feature P07 also rates three statements about the review (good moment, helped understand the code,
interrupted the work; 1–7).

**After (≈ 3 min).** Ranking of "review at the end" vs. "pause partway", debrief, Finish. P07 leaves one JSON bundle,
an event log, a screen recording and six rows in `trials.csv`:

```
participant_id,…,position,story,regime,variant,milestoneStep,flawStep,pauseStep,flawStepReviewed,…,initialDecision,finalDecision,…,u1_correct,…
P07,…,1,US1,BATCH,Correct,2,2,4,true,…,accept,accept,…
P07,…,2,US2,MILESTONE,Correct,3,2,3,false,…,reject,reject,…
…
```

## 2. The whole study: 30 people

Simulated with these assumptions (`truth_default` in `analysis/simulate.R`):

| Assumption | Value |
|---|---|
| Item about a subtask nobody paused at | 65 % correct |
| Item about the milestone subtask | harder: 53 % |
| A pause, on the item about the paused subtask | +0.3 log-odds |
| A pause **at the milestone**, on every item of the feature (H1) | +0.3 log-odds |
| ... and on the milestone item beyond that (H2) | +0.2 log-odds |
| d′ when the flaw subtask was in the review | BATCH 0.8, MILESTONE 1.3, NON_MILESTONE 1.0 |
| d′ when it was not (written before the pause, or not yet) | 0.1 |
| A pause raises confidence on every item | +4 points |

So the hypotheses are **true** in this fictitious world. Averaged over many studies, all items come out at 70 %
after a milestone pause, 61 % after a review at the end, 63 % after a pause elsewhere (+9 and +7 points); the
milestone item at 68 % against 52 % and 52 % (+16 points each). The planned analysis on one such study (seed 7):

```
== Understanding: share correct (regime x item type)
              milestone other
MILESTONE            77    72
BATCH                63    67
NON_MILESTONE        67    72

== H1 (primary): all items of the feature
                    contrast log_odds odds_ratio     z      p p_holm
1         MILESTONE vs BATCH    0.409       1.51 2.149 0.0317 0.0633
2 MILESTONE vs NON_MILESTONE    0.148       1.16 0.764 0.4448 0.4448

Sensitivity: without the flaw item
                    contrast log_odds odds_ratio    z      p p_holm
1         MILESTONE vs BATCH    0.456       1.58 2.15 0.0318 0.0636
2 MILESTONE vs NON_MILESTONE    0.168       1.18 0.78 0.4354 0.4354

== H2: the milestone item
                    contrast log_odds odds_ratio    z      p p_holm
1         MILESTONE vs BATCH    0.732       2.08 1.70 0.0885  0.177
2 MILESTONE vs NON_MILESTONE    0.574       1.78 1.33 0.1838  0.184

== Exploratory: milestone or just reviewed? (items, all regimes)
                        Estimate Std. Error z value Pr(>|z|)
reviewed                  0.6534     0.3797   1.721   0.0853
item_typeother            0.1946     0.3015   0.645   0.5187
position_c               -0.0162     0.0452  -0.359   0.7198
reviewed:item_typeother  -0.2151     0.4376  -0.491   0.6231

== Exploratory: share correct by item role
              dependency emergent flaw interplay open-case
MILESTONE             70       75   72        73        77
BATCH                 67       55   68        77        63
NON_MILESTONE         75       72   70        72        67

== Exploratory: what builds on the milestone (dependency items)
                    Estimate Std. Error z value Pr(>|z|)
regimeBATCH           -0.166      0.417  -0.399    0.690
regimeNON_MILESTONE    0.269      0.430   0.625    0.532
position_c            -0.110      0.102  -1.076    0.282

== H3: fault detection (initial decision), d' when the flaw subtask was in the review
               flaw
regime          in review before after
  MILESTONE            30     10    20
  BATCH                60      0     0
  NON_MILESTONE        30     15    15
         regime dprime criterion
1     MILESTONE   1.92      1.14
2         BATCH   1.00      1.12
3 NON_MILESTONE   1.57      1.02
                       contrast difference     z     p p_holm
1         d' MILESTONE vs BATCH      0.919 1.532 0.125  0.251
2 d' MILESTONE vs NON_MILESTONE      0.354 0.627 0.530  0.530
d' lower by 0.08 when the flaw subtask was written before the pause, by 0.97 when after

Only reviews that contained the flaw subtask:
               variant
regime          Correct Flawed
  MILESTONE          15     15
  BATCH              30     30
  NON_MILESTONE      15     15
         regime dprime criterion
1     MILESTONE  1.896      1.05
2         BATCH  0.972      1.10
3 NON_MILESTONE  1.287      0.75

== H4: confidence vs correctness (overconfidence = confidence - correct, in points)
              milestone other
MILESTONE           5.1   8.0
BATCH              11.9   6.9
NON_MILESTONE      12.1   8.8
                    Estimate Std. Error  df t value Pr(>|t|)
regimeBATCH             6.83       7.62 859   0.897    0.370
regimeNON_MILESTONE     7.00       7.62 859   0.918    0.359

Exploratory: Brier score (0 is best) and resolution (AUROC of confidence for a correct answer, .5 = none)
              brier resolution
MILESTONE     0.197      0.599
BATCH         0.211      0.666
NON_MILESTONE 0.200      0.656

== H5: reversals after the behaviour question
              Correct Flawed
MILESTONE     "0/30"  "3/30"
BATCH         "1/30"  "7/30"
NON_MILESTONE "1/30"  "4/30"
                    Estimate Std. Error z value Pr(>|z|)
regimeBATCH            1.073      0.704   1.524    0.127
regimeNON_MILESTONE    0.547      0.754   0.725    0.469

== Descriptive: time (median minutes), mental effort (Paas 1-9) and the review statements (1-7), means
              review_before_decision final_review paas good_moment helped
MILESTONE                        1.6          2.2    5         4.8    4.6
BATCH                            3.7          1.1    5         4.5    4.4
NON_MILESTONE                    1.7          2.1    5         4.4    5.1
              interrupted
MILESTONE             3.6
BATCH                 2.4
NON_MILESTONE         3.4

Final decision correct (reject flawed, accept correct): MILESTONE 72 %, BATCH 72 %, NON_MILESTONE 68 %
```

**This study finds nothing significant, although the effects are there.** On all items MILESTONE is ahead of BATCH by
0.41 log-odds (p = .03, Holm .06) and of NON_MILESTONE by 0.15 (p = .44); on the milestone item by 0.73 and 0.57
(Holm .18 each). §3 says how often a study of this size finds them.

What else the run shows:

- **The flaw item does not carry H1:** without it the contrasts are nearly the same (0.46 and 0.17).
- **d′ needs the flaw position.** With it, d′ per regime is the d′ when the flaw subtask was in the review, and the
  model estimates how much lower it is otherwise (here 0.97 when not yet written, 0.08 when written before; assumed:
  about 1.1 for both). With 30 flawed trials per regime the estimates are far from the assumed values (MILESTONE 1.92
  instead of 1.3).
- **Reversals are rare:** 16 in 180 trials, nearly all on flawed code.
- **Time:** a pause halves the time before the decision but moves time to the end, as the design implies.
- Several fits are singular (`isSingular` messages in the full output): six features are too few to estimate a
  feature variance. Expected; see `docs/study/analysis-plan.md` §4.

## 3. Power: how often does a study of this size find the effect?

250 fictitious studies per row, each analysed as planned; the share with Holm-corrected p < .05 (`power.txt`). The
effect sizes are averages over many simulated studies, MILESTONE vs. BATCH / vs. NON_MILESTONE in points; "none" has no
effect at all. In every row d′ is as in §2 (except "none": equal).

| N | Effect | All items | Milestone item | H1a M vs B | H1b M vs N | H1 both | H2a M vs B | H2b M vs N | H3 d′ M vs B | H3 d′ M vs N |
|---|---|---|---|---|---|---|---|---|---|---|
| 24 | none | 0 / 0 | 0 / 0 | 3 % | 2 % | 2 % | 2 % | 3 % | 5 % | 5 % |
| 24 | small | +7 / +5 | +11 / +11 | 32 % | 20 % | 15 % | 12 % | 13 % | 3 % | 4 % |
| 24 | medium | +9 / +7 | +16 / +16 | 51 % | 38 % | 33 % | 36 % | 35 % | 3 % | 2 % |
| 24 | large | +14 / +12 | +24 / +23 | 92 % | 85 % | 80 % | 70 % | 70 % | 4 % | 3 % |
| 30 | none | 0 / 0 | 0 / 0 | 4 % | 2 % | 0 % | 2 % | 2 % | 2 % | 2 % |
| 30 | small | +7 / +5 | +11 / +11 | 37 % | 22 % | 16 % | 15 % | 15 % | 7 % | 4 % |
| 30 | **medium** | **+9 / +7** | **+16 / +16** | **67 %** | **51 %** | **46 %** | **46 %** | **45 %** | 3 % | 5 % |
| 30 | large | +14 / +12 | +24 / +23 | 97 % | 88 % | 87 % | 80 % | 74 % | 3 % | 4 % |
| 36 | none | 0 / 0 | 0 / 0 | 3 % | 2 % | 1 % | 4 % | 2 % | 6 % | 5 % |
| 36 | small | +7 / +5 | +11 / +11 | 41 % | 24 % | 21 % | 20 % | 18 % | 2 % | 5 % |
| 36 | **medium** | **+9 / +7** | **+16 / +16** | **78 %** | **57 %** | **52 %** | **56 %** | **58 %** | 3 % | 4 % |
| 36 | large | +14 / +12 | +24 / +23 | 98 % | 94 % | 94 % | 86 % | 83 % | 4 % | 6 % |

What it means:

- **H1 on all items has more power than the milestone item alone** (300 instead of 60 items per regime). With the
  medium effect, N = 30 finds MILESTONE vs. BATCH in 2 of 3 studies, MILESTONE vs. NON_MILESTONE (the contrast about
  the place) in half; N = 36 brings that to 78 % and 57 %, N = 24 lowers it to 51 % and 38 %. 80 % for H1b needs a
  large effect, about +12 points, at any of these sizes.
- **H2 needs a large effect:** about +24 points on the milestone item for 80 % at N = 30–36 (70 % at N = 24).
- **Without an effect** every test stays at or below the nominal 5 %. For H3 that is new: without the flaw position,
  "d′ MILESTONE vs BATCH" came out significant in 8–16 % of runs, the exposure difference showing up as an effect.
- **H3 has no power** for the assumed d′ differences (0.5 and 0.3 when the flaw was in the review): 2–7 % at
  N = 24–36. It stays exploratory and is reported as estimates with confidence intervals.
- **N is not fixed** (as many as possible, about 30): each six people more or fewer move the power by about 5–15
  points. The N reached and its row here are reported as a limitation.
- The power depends on the assumptions in §2 (baseline accuracy, variances between people and features), which are
  guesses. The pilot gives real values for them; rerun `power.R` with those.
