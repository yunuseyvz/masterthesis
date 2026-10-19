# Pilot and second-rater plan

Two small checks before data collection. Each is a one-page task.

## 1. Pilot of the understanding questions (3 to 5 people)

**Goal.** Make sure the three questions per feature measure understanding, are not guessable, and fit the time budget.

**Who.** Three to five people with programming experience who are not in the later sample. Run the full session (`scripts/run-session.sh --show-condition` is for you, never for them).

**What to look at** (from the exported `trials.csv` and the logs):

| Check | Look at | Fix if |
|---|---|---|
| Too easy / too hard | `u1..u3_correct` per feature | one item is correct for everyone, or for nobody |
| Guessable | accuracy vs. the 25% chance level, option order | an item is answered above chance without having read the code |
| Both regimes work | the same items in BATCH and CHECKPOINT | an item only makes sense after one regime |
| Time | session length | well over 30 minutes |
| Wording | what the person says when asked "what did question k ask?" | they read it differently from your intent |
| Wrap-up screen | do people understand why they see more code after the decision | confusion or skipping |

**Stop rule.** Change at most the wording and the options, then re-run two people. Do not tune items on the pilot data beyond that.

## 2. Second rater for the criteria (one independent person)

**Goal.** Cohen's kappa for the binary "pause here?" decision (target 0.61 or higher) and per criterion.

**Material.** `docs/rater-sheet-corpus.csv` (24 corpus subtasks, shuffled, no model output, intended milestone hidden). The key `docs/rater-sheet-corpus.key.csv` is for analysis only and must not be shared. Trace subtasks: `docs/jev-benchmark/labeling-sheet.csv`.

**Instructions for the rater** (send these with the sheet):
1. Read the three criteria and their decision tests (the criteria page or `docs/criteria-derivation.md` §2).
2. For each row, answer each condition yes/no, then decide "pause here: yes/no". If more than one criterion matches, C1 wins over C2 over C3.
3. Do not look at the key or at any model output. About 45 minutes for 24 rows.
4. Write a note whenever a condition was hard to decide.

**Analysis.** Kappa on the binary decision and per criterion, percent agreement, and a list of disagreements with the notes. Reword the decision tests where raters disagree, then freeze the wording with a date before participant data are collected.

**Open decision.** Do test files count as "files still to be written" in C2(b)? Decide before sending the sheet, because it changes how the rater answers.
