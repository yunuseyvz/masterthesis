# Pilot plan

A small check before data collection.

## Pilot of the understanding questions (3 to 5 people)

**Goal.** Make sure the four questions per feature measure understanding, are not guessable, and fit the time budget.

**Who.** Three to five people with programming experience who are not in the later sample. Run the full session (`study-harness/scripts/run-session.sh --show-condition` is for you, never for them).

**What to look at** (from the exported `trials.csv` and the logs):

| Check | Look at | Fix if |
|---|---|---|
| Too easy / too hard | `u1..u4_correct` per feature | one item is correct for everyone, or for nobody |
| Guessable | accuracy vs. the 25% chance level, option order | an item is answered above chance without having read the code |
| All regimes work | the same items in BATCH, MILESTONE and NON_MILESTONE | an item only makes sense after one regime |
| Time | session length | well over 60 minutes |
| Wording | what the person says when asked "what did question k ask?" | they read it differently from your intent |
| Wrap-up screen | do people understand why they see more code after the decision | confusion or skipping |

**Stop rule.** Change at most the wording and the options, then re-run two people. Do not tune items on the pilot data beyond that.
