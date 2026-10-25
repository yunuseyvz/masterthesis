# Recording protocol: the agent sessions behind the study

How the seven agent sessions the participants see (`captures/US0-deepseek` … `US6-deepseek`) were produced: the
model and setup, every prompt the model received, the procedure, the acceptance checks, and how a recording became a
trial. Technical details of the tools: [technical.md](technical.md) §4–6.

## 1. Setup

| | |
|---|---|
| Agent | opencode 2.1.3 (`@opencode/cli`), its standard Plan and Build agents |
| Model | DeepSeek V4.1 Flash (`deepseek-v4.1-flash`) via OpenCode Go (`https://opencode.ai/zen/go/v1`) |
| Sampling | provider defaults: opencode sends no temperature or top_p |
| Project | `capture-tool/seeds/shopfront`, a small Next.js/TypeScript shop, copied fresh for every recording |
| Date | 2026-10-24 (US1 and US2 re-recorded the same day, §4) |
| Recording | `npm run capture -- record` (capture tool), scripted turns, no human in the loop |

opencode ran with a private home directory, so no personal configuration, instructions or plugins reached it. Its
only provider was the capture tool's recording proxy, which forwarded each request unchanged to OpenCode Go and
recorded the streamed response with its timing. One setting differs from a default install: the `question` tool
(multiple-choice questions to the user) is denied, because a replay could not answer it.

The command, for each story `<id>`:

```bash
CAPTURE_API_KEY=... npm run capture -- record --id <id>-deepseek --model deepseek-v4.1-flash \
  --upstream https://opencode.ai/zen/go/v1 --turns capture-tool/turns/<id>.json \
  --brief capture-tool/briefs/study.md --brief capture-tool/briefs/outlines/<id>.md
```

## 2. What the model received

Each request had four layers. A complete request, reconstructed with the same opencode version and briefs, is in
[recording/request-example-US1.md](recording/request-example-US1.md).

1. **opencode's own system prompt** (unchanged): role, tool usage, code-mode tool catalogue, skills, environment
   (project path, date, platform).
2. **The study brief**, appended to that system prompt. It is opencode's global instruction file (`AGENTS.md` in the
   private home), which opencode adds to every request as `Instructions from: …/AGENTS.md`. It consists of the general
   brief and the story's step outline, joined in that order.
3. **The person's two messages**: the story request (Plan agent), then the approval (Build agent).
4. **opencode's mode reminders**: while the Plan agent is active, every request carries a `<system-reminder>` that
   the agent may only discuss the plan; after the switch, one reminder that Plan mode is over.

The brief is not part of the conversation and is not shown in opencode's interface. The replay in the study does not
send it either: the study's opencode has no such file, and the replay answers each request with the recorded
response for its position. Participants therefore see the same conversation the model had, minus the brief.

### 2.1 The general brief (`capture-tool/briefs/study.md`)

```markdown
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
```

Why each rule is there:

| Rule | Purpose for the study |
|---|---|
| Exactly four steps, announced with `Step N:` | Every story has the four steps the design needs, and the step boundaries can be found in the recording |
| One step per response, never two | A checkpoint can only fall between two model responses, so each boundary must be one |
| All steps in one go | The recording runs without a human in the loop; the pauses are added later by the replay |
| 10–40 changed lines per step | Steps of similar size, so a pause after one step does not review far more code than after another |
| Tests only in step 4 | The earlier steps stay free of test runs, and the flaw step's code is reviewed, not just its test output |
| No questions | A replay could not answer them |
| "Follow them without mentioning them" | The visible conversation reads like an ordinary session |

The brief says nothing about the study, reviews, pauses, conditions or flaws.

### 2.2 The step outlines (`capture-tool/briefs/outlines/<id>.md`)

The outline fixes what each step does, and so which step is the milestone (the design needs the milestone at step 1,
2 and 3 in two stories each). The outlines name the files and the responsibility of each step, not the code. They
follow the synthetic stories that preceded the recordings. Full text in the files; in short:

| Story | Step 1 | Step 2 | Step 3 | Step 4 |
|---|---|---|---|---|
| US0 | greeting types | **greeting formatter** | batch helper | tests, README |
| US1 | inventory types, `OutOfStockError` | **stock reservation** | checkout handler | route, seeded stock, tests, README |
| US2 | webhook event and event-log types | event parsing (decimal dollar strings to cents) and crediting | **deduplication and retry** | endpoint, route, event log, tests, README |
| US3 | tenant types and organization defaults | **configuration merging** | quota checks, `QuotaExceededError` | tests, README |
| US4 | **duration parsing** | SLA tier and invoice types | invoice generator | tests, README |
| US5 | rate-limit types and defaults | client identification, 429 response | **sliding-window check** | gateway filter, tests, README |
| US6 | **discount calculation** | coupon and order-summary types | order summary calculator | tests, README |

Bold: the milestone step.

### 2.3 The person's messages (`capture-tool/turns/<id>.json`)

Turn 0, to the Plan agent, is the story's user story, the same text the participant later sees as the request that
started the session. Turn 1, to the Build agent, is always `The plan looks good. Go ahead.` (in the study it is sent
when the participant clicks "Approve plan").

| Story | Request (turn 0) |
|---|---|
| US0 | As a user, I want the app to greet me by name, so that it feels friendly. This is a practice story: take your time to explore the interface. |
| US1 | As a customer during a flash sale, I want to reserve stock for the items in my cart so that I don't lose them while I check out. If the shop can't fulfil my order, I should be told. |
| US2 | As a payments engineer, I want the webhook endpoint to credit a customer's account when a payment event arrives, so that customers see their balance update. The payment provider may deliver the same event more than once, and processing can fail temporarily. |
| US3 | As a platform admin, I want each tenant to be able to customize its feature flags and limits, so that tenants can differ from the organization defaults where they need to. |
| US4 | As a billing owner, I want outages measured against our SLA threshold and credited on the invoice, so that customers are compensated when we miss the SLA. |
| US5 | As an API owner, I want each client limited to a number of requests per minute, so that no single client can overload the gateway. |
| US6 | As a shopper, I want to apply a coupon to my order, so that I pay the discounted price. |

The US0 request includes the sentence addressed to participants ("This is a practice story…"); the model received it
too.

## 3. Procedure

For each story the capture tool:

1. copied the seed project into a fresh git repository ("Initial commit");
2. started opencode on it with the configuration and brief above;
3. opened a session with the Plan agent and sent turn 0; the agent explored the code (read, glob, grep, shell) and
   answered with its plan;
4. switched the session to the Build agent and sent turn 1; the agent implemented the four steps, ran `npm test`, and
   fixed failures if any;
5. stored every model request and its streamed response with the arrival time of each chunk (`capture.json`), and the
   project before every request and at the end (`history.bundle`).

The first seven recordings ran in parallel, the two re-recordings on their own; each took one to two minutes.

## 4. Pilot and re-recordings

- **Without a brief** (`captures/deepseek-lowstock`, a low-stock report): the agent's work did not fall into four
  usable steps. Its first build response edited four files for different purposes, the core logic, route, page and
  tests came in one response, and the last seven responses only ran checks. This motivated the brief.
- **First brief** (low-stock report): the agent completed step 1 and ended its turn to wait for confirmation. The
  rule "Do all four steps in one go …" was added; the next recording (`captures/deepseek-lowstock-steps`) produced
  four clean steps.
- **US1, re-recorded**: in the first recording step 3 (checkout handler, route and seeded stock) changed 73 lines
  against 19 and 25 in steps 1 and 2. The outline moved the route and the seeded stock to step 4; the re-recording has
  20 / 29 / 18 changed lines.
- **US2, re-recorded**: the first recording's tests exercised every edge of the code in steps 1–2, so no flaw could
  be planted there that the agent's own tests would not catch (§6). The outline added that the provider sends amounts
  as decimal dollar strings, which gives step 2 a conversion to get right.

All other stories were used from their first recording.

## 5. Acceptance checks

A recording was accepted when (checked by `inspect` and `npm test`):

- the agent announced steps 1–4 in order, each in a new response, with no response announcing two steps;
- the visible tests passed at the end;
- steps 1–3 were within a factor of 3 of each other in changed lines (the steps a pause can follow);
- the milestone step changed at least 8 lines;
- a flaw could be planted in the designed step that the agent's own tests do not detect (§6).

## 6. From recording to trial

Each recording is used as recorded except for one minimal patch that makes the other variant. The
patch changes the arguments of one recorded tool call; every later file state follows from it, and the replay applies
it while streaming with the recorded timing. Because the agent's tests are written in step 4, after the flaw step,
every flaw is one that those tests miss: participants who run `npm test` see all tests pass in both variants.

| Story | Steps start at | Flaw step | Flawed variant |
|---|---|---|---|
| US0 | @5 / @6 / @8 / @9 | – | practice, no flaw |
| US1 | @5 / @6 / @7 / @8 | 2 (milestone) | a sold-out item can be reserved (`available && available < quantity`; 0 is falsy), stock goes negative |
| US2 | @5 / @6 / @7 / @8 | 2 | the credit converts with `Math.floor(Number(amount) * 100)` instead of the exact conversion: "19.99" credits 1998 cents |
| US3 | @5 / @6 / @7 / @8 | 3 | the quota check adds 1 instead of the requested amount: a bulk operation can pass the limit |
| US4 | @4 / @5 / @7 / @8 | 3 | as recorded: an outage that crosses the end or start of the billing period is skipped (the Correct variant clamps it to the period) |
| US5 | @4 / @5 / @6 / @7 | 3 (milestone) | rejected requests are recorded in the window: a client that keeps retrying stays blocked |
| US6 | @6 / @7 / @10 / @11 | 1 (milestone) | a 100% coupon is rejected (`value >= 100`) |

`@N` is the position of the step's first model response; a checkpoint after step k stops the replay before step
k+1's first response. Each trial also has three behaviour probes (steps 1–3) and four understanding items (one per
step), each answered by running the code in both variants (`study-harness/trials/<id>/`).

Verification: `npm test` checks every trial (both variants pass the visible tests; every probe and understanding
answer is what the code does; only the flaw step's probe and item differ between variants; step sizes; the 3/3 split of
flaws in milestone and non-milestone steps). Each story was also replayed in real opencode in both variants with the
milestone pause: in all 13 runs the project at the pause and at the end was identical to the expected state, with
every recorded response served and no replay errors.

## 7. The recordings

| Story | Model calls | Plan / build responses | Plan / build time (s) | Changed lines, steps 1–4 | Tests passing at the end | Prompt / completion tokens |
|---|---|---|---|---|---|---|
| US0 | 13 | 5 / 8 | 16 / 24 | 12 / 18 / 7 / 51 | 24 | 165,794 / 6,124 |
| US1 | 12 | 5 / 7 | 23 / 31 | 20 / 29 / 18 / 95 | 23 | 170,192 / 9,440 |
| US2 | 17 | 5 / 12 | 24 / 69 | 42 / 41 / 60 / 249 | 29 | 285,959 / 14,204 |
| US3 | 11 | 5 / 6 | 16 / 27 | 48 / 36 / 34 / 100 | 26 | 137,383 / 7,327 |
| US4 | 15 | 4 / 11 | 18 / 49 | 63 / 47 / 86 / 156 | 32 | 210,328 / 10,153 |
| US5 | 11 | 4 / 7 | 17 / 38 | 22 / 29 / 40 / 103 | 23 | 147,828 / 10,118 |
| US6 | 15 | 6 / 9 | 25 / 31 | 34 / 29 / 29 / 96 | 24 | 193,630 / 9,374 |

Times are model time from the first to the last response of each turn, as recorded and as replayed (`REPLAY_PACE=1`).
Changed lines are counted in the Correct variant. Token counts are the provider's usage figures summed over all
calls (prompt tokens repeat the growing conversation with each call). Tests: the whole suite (`npm test`), of which
the story's own tests are a part.

## 8. Limitations

- **One run per story.** Each session is a single sample from a non-deterministic model, chosen for meeting the
  checks in §5, not a typical or average run.
- **The brief shapes the work.** Fixed steps, one step per response and tests only at the end make the sessions more
  regular than an unconstrained agent's. The outlines were written by the researcher, so the decomposition (and the
  milestone's place) is a design choice, not the agent's own.
- **Planted flaws.** Five flaws are one-line edits of the recorded code, and the US4 flaw is the agent's own behaviour,
  with the Correct variant patched. All were chosen so that the agent's own tests miss them.
- **One model and one tool.** DeepSeek V4.1 Flash in opencode 2.1.3; other models or agents may structure and phrase
  their work differently.
- **Timing.** Response timing is OpenCode Go's on the recording day, replayed unchanged; tool execution (tests, file
  writes) happens live in the participant's session.
