# A fictitious study

A dry run of the study before it happens: what one person goes through and what data that produces (§1), a whole
study of 30 people analysed as planned (§2), and how often a study of this size would find the effect at all (§3).
**All numbers here are invented.** They come from assumed effects, not from people.

Reproduce:

```
npx tsx analysis/design.ts 30 > analysis/scenario/design.csv        # the real design: groups, rounds, pause steps
Rscript analysis/simulate.R analysis/scenario/design.csv analysis/scenario/trials.csv 7
Rscript analysis/analyze.R analysis/scenario/trials.csv              # the planned analysis (docs/analysis-plan.md)
Rscript analysis/power.R 250 30,60                                   # §3, about 25 minutes on 4 cores
```

## 1. One person: P07

P07 is the seventh person to come in. Six sessions are finished in `exports/` before them, so `run-session.sh` gives
group 0 (6 mod 6) and round 1 (one earlier group-0 session, P01's). Group 0
fixes the order and conditions; round 1 makes their NON_MILESTONE pauses the other candidate subtask than P01's.

**Before (≈ 8 min).** Consent, demographics, NCS-6 with the attention check, S-TIAS. Then the practice feature
(`US0`, greeting formatter): plan, approve, pause after subtask 2, accept, behaviour question, the rest, four
understanding questions. Nothing of it is analysed.

**Six features (≈ 7 min each).**

| # | Feature | Condition | What P07 reviews before deciding | Decision (→ after the behaviour question) | Understanding |
|---|---|---|---|---|---|
| 1 | US1 Flash-sale reservation | BATCH · correct | all four subtasks, 162 lines | accept | 3/4 |
| 2 | US2 Payment webhook | MILESTONE · correct | subtask 3, deduplication and retry | reject (a false alarm) | 4/4 |
| 3 | US6 Coupons | NON_MILESTONE · **flawed** | subtask 3, the order summary; the flaw is in subtask 1 | reject | 3/4 |
| 4 | US3 Tenant configuration | NON_MILESTONE · correct | subtask 3, the quota checks | accept | 4/4 |
| 5 | US5 Rate limiter | MILESTONE · **flawed** | subtask 3, the sliding-window check, with the flaw in it | reject | 4/4 |
| 6 | US4 SLA credits | BATCH · **flawed** | all four subtasks, 352 lines | accept → **reject** | 3/4 |

Things to notice:

- In trial 3 P07 rejects flawed code without the flaw being in the review. Right decision, but not from having seen
  the flaw; `flawStepReviewed = false` marks this.
- In trial 6 the behaviour question asks about the flaw subtask (BATCH always does), and running the code changes
  the decision. That is one reversal.
- The milestone item in trial 5 (subtask 3) is right and answered with 93 % confidence; in trial 6 (BATCH, milestone
  subtask 1) it is wrong at 50 %.

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
| A pause **at the milestone**, on its item, beyond that | +0.5 log-odds, together 53 % → 71 % |
| d′ when the flaw subtask was in the review | BATCH 0.8, MILESTONE 1.3, NON_MILESTONE 1.0 |
| d′ when it was not | 0.1 |
| A pause raises confidence on every item | +4 points |

So the hypothesis is **true** in this fictitious world, by 18 points on milestone items. The planned analysis on one
such study (seed 7):

```
== Understanding: share correct (regime x item type)
              milestone other
MILESTONE            58    71
BATCH                60    72
NON_MILESTONE        60    74

== H1 (primary): milestone items
                    contrast log_odds odds_ratio      z     p p_holm
1         MILESTONE vs BATCH  -0.0775      0.925 -0.198 0.843      1
2 MILESTONE vs NON_MILESTONE  -0.0765      0.926 -0.195 0.845      1

== H2: fault detection (initial decision)
         regime dprime criterion
1     MILESTONE  0.465     0.559
2         BATCH  0.925     1.198
3 NON_MILESTONE  1.404     1.401

Only reviews that contained the flaw subtask:
               variant
regime          Correct Flawed
  MILESTONE          15     15
  BATCH              30     30
  NON_MILESTONE       8      7

== H4: reversals after the behaviour question
              Correct Flawed
MILESTONE     "0/30"  "5/30"
BATCH         "2/30"  "4/30"
NON_MILESTONE "0/30"  "4/30"

== Descriptive: time (median minutes) and mental effort (Paas, mean)
              review_before_decision final_review paas
MILESTONE                        1.9          2.1    5
BATCH                            3.6          1.1    5
NON_MILESTONE                    1.6          2.2    5
```

**This study finds nothing, although the effect is there.** Milestone items come out at 58 % after a milestone pause
and 60 % otherwise. With 600 instead of 30 people the same simulation gives 71 % vs. 56 % and 53 %, the assumed
values. At N = 30, 60 milestone items per regime from 30 people and six features are too few to see an 18-point
effect reliably; §3 says how often.

What else the run shows:

- **d′ is noisy and confounded with exposure.** MILESTONE has the *lowest* d′ here although the assumed d′ is the
  highest, because half of its flawed reviews do not contain the flaw. Only the subset with `flawStepReviewed` is
  interpretable, and it has 7 flawed NON_MILESTONE trials.
- **Reversals are rare:** 15 in 180 trials, nearly all on flawed code.
- **Time:** a pause halves the time before the decision but moves time to the end, as the design implies.
- Several fits are singular (`isSingular` messages in the full output): six features are too few to estimate a
  feature variance. Expected; see `docs/analysis-plan.md` §4.

## 3. Power: how often does a study of this size find the effect?

250 fictitious studies per row, each analysed as planned; the share with Holm-corrected p < .05
(`analysis/scenario/power.txt`). The effect is the one on milestone items, as in §2; "none" has no effect at all.

| N | Effect on milestone items | H1a M vs B | H1b M vs N | H1 both | H2 d′ M vs B | H2 d′ M vs N |
|---|---|---|---|---|---|---|
| 30 | none | 2 % | 2 % | 0 % | 8 % | 8 % |
| 30 | small, +9 points | 10 % | 9 % | 6 % | 3 % | 9 % |
| 30 | **medium, +18 points** | **43 %** | **43 %** | **33 %** | 6 % | 6 % |
| 30 | large, +26 points | 79 % | 78 % | 70 % | 2 % | 6 % |
| 60 | none | 1 % | 3 % | 0 % | 16 % | 3 % |
| 60 | small, +9 points | 23 % | 24 % | 14 % | 4 % | 10 % |
| 60 | medium, +18 points | 74 % | 70 % | 62 % | 5 % | 8 % |
| 60 | large, +26 points | 98 % | 98 % | 97 % | 4 % | 9 % |

What it means:

- **H1 at N = 30 needs a large effect.** With the assumed 18 points a study of 30 finds each contrast in about 4 of 10
  runs; 80 % power needs about 26 points. Doubling to 60 people brings 18 points to about 70 %. Without an effect,
  H1 is rarely significant (≤ 3 %), so the test is conservative, not too liberal.
- **H2 as planned cannot show the assumed d′ advantage.** The assumed world gives MILESTONE the best d′ *when the flaw
  is in the review*, but it contains the flaw only half the time, so over all trials the advantage disappears. With no
  effect at all, "MILESTONE vs BATCH" still comes out significant in 8–16 % of runs, above the nominal 5 %: that is the
  exposure difference, not the pause. H2 is therefore descriptive only, or tested on `flawStepReviewed` trials,
  which N = 30 makes small.
- The power depends on the assumptions in §2 (baseline accuracy, variances between people and features), which are
  guesses. The pilot gives real values for them; rerun `power.R` with those.

Options for the design, for the discussion with the supervisor:

1. **Keep N = 30** and state that only a large effect (about 25 points) is reliably detectable; small effects are
   reported as estimates with confidence intervals.
2. **More data per person:** two understanding items per milestone subtask instead of one gives twice the milestone
   items without more participants (less than twice the information, since items about the same subtask correlate).
3. **N = 60** (ten per group) for about 70 % power at 18 points.
4. Make **H1 the only confirmatory test** and H2–H4 explicitly exploratory, as above.
