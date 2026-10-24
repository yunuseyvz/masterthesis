# Capture tool

Records real opencode sessions so the study harness (`harness/`) can replay them 1:1: the same text, tool calls, token
timing and time to complete. The harness then plants its checkpoints and variants into the replay.

## Record a session

```bash
export CAPTURE_API_KEY=...        # key for the upstream API
npm run capture -- record --id my-feature --model anthropic/claude-sonnet-4.5
```

This copies `capture/seeds/shopfront` into a fresh git repository and opens opencode's terminal UI on it, with the
model behind a recording proxy. Work in the session as you normally would (switch to Plan mode for the plan, then
approve it, and so on); quit opencode when you are done. The capture is written to `captures/my-feature/`.

- `--upstream URL`: any OpenAI-compatible API (default `https://openrouter.ai/api/v1`; e.g. `https://api.openai.com/v1`,
  OpenCode Go `https://opencode.ai/zen/go/v1`, or a local server). The model id is the upstream's. The proxy passes
  opencode's own request headers through unchanged and only sets the key.
- `--allow-questions`: let the agent ask multiple-choice questions (opencode's `question` tool). Off by default: a
  replay would put the question in front of a participant and wait for an answer.
- `--brief FILE`: standing instructions for the agent, which it follows without the person seeing them (written as
  opencode's global `AGENTS.md`, so they are in every request's system prompt; kept in `capture.json` as `brief`).
  `capture/briefs/study.md` asks for four numbered steps done one per response, each opened with `Step N: ...`, so
  every step boundary is a place a checkpoint can go. The replay never sends the brief. Repeat `--brief` to add a
  story's step outline (`capture/briefs/outlines/<id>.md`), which fixes what each step does and so where the
  milestone falls.
- `--seed DIR`: start from another project.
- `--web`: use opencode's web UI instead (the URL and password are printed; Ctrl+C ends the capture).
- `--turns FILE`: no UI; send scripted turns, a JSON array of `{ "text": "...", "agent": "plan" }`.
- `--out DIR`: write somewhere else than `captures/<id>`.

For the study's flow, a capture should start with the request in Plan mode and continue with the approval of the plan
in build mode; the trial says which turn is the approval.

Example (OpenCode Go, DeepSeek; this made `captures/deepseek-lowstock-steps`, used by `harness/trials/lowstock`;
without `--brief` it made `captures/deepseek-lowstock`):

```bash
CAPTURE_API_KEY=... npm run capture -- record --id deepseek-lowstock-steps --model deepseek-v4.1-flash \
  --upstream https://opencode.ai/zen/go/v1 --turns capture/turns/lowstock.json --brief capture/briefs/study.md
```

## Look at a capture

```bash
npm run capture -- inspect captures/my-feature
```

lists the main conversation's responses with their positions (`@N`), duration, text, tool calls and changed files. A
checkpoint at `@N` stops the replay before the response at position N, after every earlier tool call has run. When
the agent announced its steps (`Step N: ...`, as the study brief asks), it also proposes the four step starts for
`trial.json`, and warns when one response announces two steps.

## Use it in the study

Write `harness/trials/<id>/trial.json` pointing to the capture: where each of the four steps starts (positions from
`inspect`), which step is the milestone, a patch for the variant that differs from the recording, and the probe and
understanding questions with their scripts. `npm test` checks the trial. Details: `docs/technical.md` §6.

The study's captures (`captures/US0-deepseek` … `US6-deepseek`) were recorded the same way, one per story:

```bash
CAPTURE_API_KEY=... npm run capture -- record --id US1-deepseek --model deepseek-v4.1-flash \
  --upstream https://opencode.ai/zen/go/v1 --turns capture/turns/US1.json \
  --brief capture/briefs/study.md --brief capture/briefs/outlines/US1.md
```

## Synthetic captures

`capture/synthetic/US0`–`US6` are scripted stories. `npm run capture -- synthesize --story capture/synthetic/US1`
turns one into `captures/US1` with timing modelled on a streaming model, in the same format as a recording. The
trials used them before the recorded captures; they remain as a fallback.

## What is recorded

`capture.json`: every model request opencode made (its conversation thread, position, tools offered) with the response
as streamed, each chunk with the time it arrived; the person's messages with their agent; the project path. 
`history.bundle`: a git bundle with the project before every request and at the end. Format: `docs/technical.md` §3.
