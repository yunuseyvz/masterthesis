# Example export

What `exports/` holds after one complete session. **Fictitious:** participant P07 (group 2, round 0) was played by
a script through the real study state machine and export code, with the fake agent and a simulated clock
(session on 5 Nov 2026, 10:00 UTC). Answers, decisions and times are invented.

| File | Contents |
|---|---|
| `P07_7.events.jsonl` | Every event in order, one `{t, type, data}` per line (190 here) |
| `P07_7.json` | The bundle written at Finish: session plan, six trials, practice, surveys, event log |
| `trials.csv` | One row per measured trial (6), the input for `analysis/analyze.R` |

Not in this example: the screen recording (`P07_7.recording.jsonl`, written by the browser), and the agent events of
a real session (`agent_*`, `live_call`), since the fake agent runs neither opencode nor a model. The UI telemetry is a
plausible handful of events (changes view, code on screen, terminal, test runs), not a real person's.

Made before the agent played live: it also lacks the events the live flow adds (`trial_prepare`, `live_checkpoint`,
`live_probe`, `live_key`, `feedback_*`), and its flaw-region values (`flawRegion*`), which stay 0 in live sessions,
are invented. The columns of `trials.csv` are unchanged.

Column meanings: [../telemetry.md](../telemetry.md).
