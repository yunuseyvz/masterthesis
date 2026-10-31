/**
 * Test run: plays one story with a real model through real opencode, without a participant, and reports how the
 * agent kept to the Drehbuch. The study flow runs as for a participant (the trial is the session's practice trial);
 * the run accepts at the review, answers the first option and stops before the understanding questions.
 *
 *   LIVE_API_KEY=... npx tsx src/live-run.ts --story US1 --variant Flawed --regime MILESTONE \
 *     --model deepseek-v4.1-flash [--upstream https://opencode.ai/zen/go/v1] [--out /tmp/live-runs]
 *
 * Keeps the trial's project, the event log and a summary (summary.json) in the output folder.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { generateSessionPlan, type Regime, type Variant } from "@beacon/shared";
import { OpencodeHost } from "./agent.js";
import { CheckpointServer } from "./checkpoint.js";
import { LiveEndpoint } from "./live.js";
import { StudySession, type StudyEvent } from "./machine.js";
import { runProbe } from "./runner.js";
import { makeStoryLoader } from "./trial.js";
import { readWorkspace } from "./workspace.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: a } = parseArgs({
  options: {
    story: { type: "string", default: "US1" },
    variant: { type: "string", default: "Correct" },
    regime: { type: "string", default: "MILESTONE" },
    pause: { type: "string", default: "0" },
    model: { type: "string", default: "deepseek-v4.1-flash" },
    upstream: { type: "string", default: "https://opencode.ai/zen/go/v1" },
    out: { type: "string", default: "/tmp/live-runs" },
    /** First of four loopback ports (opencode, live endpoint, checkpoint server); several runs need different ones. */
    ports: { type: "string", default: "4890" },
    /** Reject at the review and give this answer when the agent asks what to change. */
    reject: { type: "string" },
  },
});
const variant = a.variant as Variant;
const regime = a.regime as Regime;
const out = path.join(a.out!, `${a.story}-${variant}-${regime}-${new Date().toISOString().replace(/[:.]/g, "-")}-${a.ports}`);
const port = Number(a.ports);
fs.mkdirSync(out, { recursive: true });

const trialsDir = path.resolve(here, "../../trials");
const loadStory = makeStoryLoader(trialsDir, path.resolve(here, "../../project"));
const story = loadStory(a.story!);

const events: StudyEvent[] = [];
let session: StudySession | undefined;
const log = (type: string, data: unknown) => session?.log(type, data);
const live = { endpoint: new LiveEndpoint({ upstream: a.upstream!, apiKey: process.env.LIVE_API_KEY, log }), checkpoints: new CheckpointServer(log) };
await live.endpoint.listen(port + 2);
await live.checkpoints.listen(port + 3);
const agent = await new OpencodeHost({
  bin: path.resolve(here, "../../../node_modules/.bin/opencode"),
  port: port + 1,
  home: path.join(out, "home"),
  sandbox: {},
  log,
  live: { url: `http://127.0.0.1:${port + 2}/v1`, model: a.model!, checkpointUrl: `http://127.0.0.1:${port + 3}/mcp` },
}).start();

const plan = generateSessionPlan({ participantId: "CAST", studySeed: "1", group: 0 });
plan.practice = { ...plan.practice, story: story.def.id as typeof plan.practice.story, regime, variant, pauseDraw: Number(a.pause) };
const sink = (e: StudyEvent) => {
  events.push(e);
  fs.appendFileSync(path.join(out, "events.jsonl"), JSON.stringify(e) + "\n");
  if (/^(live_|checkpoint_|agent_turn|review_shown|trial_start)/.test(e.type) && e.type !== "live_call") console.log(e.type, JSON.stringify(e.data).slice(0, 200));
  if (e.type === "live_call") {
    const d = e.data as { thread: string; position: number; ms: number; tools: string[]; usage: unknown };
    console.log(`  call ${d.thread === "main" ? "main" : "side"} @${d.position} ${((d.ms ?? 0) / 1000).toFixed(1)}s ${d.tools.join(",") || "text"} ${JSON.stringify(d.usage)}`);
  }
};
session = new StudySession(plan, loadStory, { agent, ...live, workRoot: path.join(out, "work"), sandbox: {} }, sink);

const started = Date.now();
try {
  await session.act({ type: "begin" });
  await session.act({ type: "presurvey", consent: true, demographics: { ageGroup: "25-34", programmingYears: "3-5", aiAssistantUse: "weekly", codeReviewFrequency: "weekly", tsFamiliarity: 4 }, ncs: [4, 3, 2, 2, 5, 4], attention: 4, stias: [5, 5, 4] });
  const dir = path.join(out, "work", "00-" + story.def.id);
  await session.act({ type: "approvePlan" });
  const atReview = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: dir, encoding: "utf8" }).trim();
  await session.act({ type: "stage1", decision: a.reject ? "reject" : "accept" });
  let view = await session.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
  if (view.phase === "feedback") {
    // The agent has asked what to change; the answer goes in as from opencode's composer.
    const asked = live.endpoint.calls().filter((c) => c.thread !== undefined).at(-1);
    console.log("agent asked:", JSON.stringify(asked ? asked.chunks.map((ch) => { try { return JSON.parse(ch.data).choices?.[0]?.delta?.content ?? ""; } catch { return ""; } }).join("") : ""));
    await session.composerMessage(`/api/session/${view.agentSessionId}/prompt`, JSON.stringify({ text: a.reject }));
    while (session.view().phase !== "reviewing") await new Promise((r) => setTimeout(r, 500));
    view = session.view();
  }
  // Not "reviewed": that would start preparing the session's next trial.
  // Stops before the understanding questions: answering them would start the session's next trial.

  // What was played, against the Drehbuch.
  const files = readWorkspace(dir, {});
  const probes = await Promise.all(story.def.probes.map(async (p) => ({ step: p.step, printed: await runProbe(files, story.probeScript(p)), expected: p.expected })));
  const flawProbe = story.flawStep ? probes.find((p) => p.step === story.flawStep) : undefined;
  const tests = spawnSync("node", ["--test", "test/**/*.test.ts"], { cwd: dir, encoding: "utf8" });
  const calls = events.filter((e) => e.type === "live_call").map((e) => e.data as { thread: string; ms: number; usage?: { prompt?: number; completion?: number } | null });
  const main = calls.filter((c) => c.thread === "main");
  const texts = live.endpoint.calls().map((c) => c.chunks.map((ch) => { try { return JSON.parse(ch.data).choices?.[0]?.delta?.content ?? ""; } catch { return ""; } }).join(""));
  const summary = {
    story: story.def.id, variant, regime, model: a.model, minutes: +((Date.now() - started) / 60000).toFixed(1),
    checkpoints: events.filter((e) => e.type === "live_checkpoint").map((e) => (e.data as { step: number }).step),
    pauseMissed: events.some((e) => e.type === "live_pause_missed"),
    stepAnnouncements: texts.flatMap((t) => [...t.matchAll(/\bStep (\d):/g)].map((m) => Number(m[1]))),
    commits: execFileSync("git", ["log", "--format=%s"], { cwd: dir, encoding: "utf8" }).trim().split("\n").reverse(),
    filesAtReview: atReview.split("\n").filter(Boolean),
    mainCalls: main.length, sideCalls: calls.length - main.length,
    tokens: { prompt: calls.reduce((n, c) => n + (c.usage?.prompt ?? 0), 0), completion: calls.reduce((n, c) => n + (c.usage?.completion ?? 0), 0) },
    modelSeconds: +(calls.reduce((n, c) => n + (c.ms ?? 0), 0) / 1000).toFixed(1),
    probes,
    flawLanded: flawProbe ? flawProbe.printed === flawProbe.expected.Flawed && flawProbe.expected.Flawed !== flawProbe.expected.Correct : null,
    flawProbeMatchesVariant: flawProbe ? flawProbe.printed === flawProbe.expected[variant] : null,
    understandingKey: events.find((e) => e.type === "live_key")?.data,
    feedback: a.reject ?? null,
    visibleTests: tests.status === 0 ? "pass" : "fail",
  };
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
  console.log("\n" + JSON.stringify(summary, null, 2) + `\n\nKept in ${out}`);
} finally {
  agent.close();
  live.endpoint.close();
  live.checkpoints.close();
}
process.exit(0);
