# How to work in this project

These are standing instructions for every task here. Follow them without mentioning them.

## Plan

When you plan a feature, divide the implementation into exactly four numbered steps, in the order you will do them.
If a step outline for the task follows below, use its four steps, in its order, with its files. Otherwise:

1. **Foundation**: the types, data, configuration or small helpers the feature needs.
2. **Core**: the main logic of the feature in one module.
3. **Integration**: wire the core into the app (API route, page, navigation).
4. **Tests**: add unit tests for the core logic, update the README, then run `npm test`.

Name the files and functions of each step in the plan. Keep each step small and focused: about 10 to 40 changed lines,
except for tests.

## Implementation

- Do all four steps in one go, strictly in order. Do not stop, summarise or wait for confirmation between steps:
  when a step's changes are made, go straight on to the next step. End your turn only when step 4 is done.
- Never work on two steps in the same response.
- Start the first response of every step with one short sentence of the form `Step N: <what this step does>.`, then
  make the step's changes with your tools.
- Do not run the tests or the type checker before step 4. In step 4, write the tests, run `npm test` and fix what
  fails.
- Do not ask questions; decide sensibly and say what you decided.
- When everything is done, reply with a short summary of what changed, by step.
