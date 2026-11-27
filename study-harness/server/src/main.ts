import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
// Behind Conditioner a pod belongs to one participant; these come from its environment.
const platformUser = env.STUDY_USER_ID;
const participantId = env.PARTICIPANT_ID ?? platformUser?.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
const studySeed = env.STUDY_SEED ?? (platformUser ? String(createHash("sha256").update(platformUser).digest().readUInt32BE(0)) : undefined);
if (!participantId || !studySeed) throw new Error("PARTICIPANT_ID and STUDY_SEED are required");
// The ID is used in export file names, so reject anything that could escape the export directory.
if (!/^[A-Za-z0-9]{1,32}$/.test(participantId)) throw new Error(`PARTICIPANT_ID must be 1-32 letters/digits, got "${participantId}"`);

const exportDir = env.EXPORT_DIR ?? "/exports";
const trialsDir = env.TRIALS_DIR ?? path.resolve(here, "../../trials");
const projectDir = env.PROJECT_DIR ?? path.resolve(here, "../../project");
const uid = env.SANDBOX_UID !== undefined ? Number(env.SANDBOX_UID) : undefined;
const gid = env.SANDBOX_GID !== undefined ? Number(env.SANDBOX_GID) : uid;
// Grading runs the trial's code, which the participant can change; never as the server's root.
if (uid !== undefined && env.PROBE_UID === undefined) throw new Error("SANDBOX_UID needs PROBE_UID: the user that runs the trial's code for grading");
const probeUid = env.PROBE_UID !== undefined ? Number(env.PROBE_UID) : undefined;
// An export directory in a fresh volume does not exist yet, so the startup check would pass and it would come out readable.
if (uid !== undefined) {
  fs.mkdirSync(exportDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(exportDir, 0o700);
}
// An empty LISTEN_SOCKET falls back to TCP on LISTEN_HOST:PORT (e.g. behind a reverse proxy).
const socketPath = env.LISTEN_SOCKET || undefined;
const host = env.LISTEN_HOST ?? "127.0.0.1";
const port = Number(env.PORT ?? 5185);

function minutes(value: string | undefined, fallback: number) {
  const n = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`a time limit must be a number of minutes >= 0, got "${value}"`);
  return n * 60_000;
}

const demo = env.DEMO === "1";
if (demo) console.warn("[study] DEMO=1: after Finish the harness starts a fresh session instead of exiting. Do not use for real participants.");
// TRY_TRIAL=US1,MILESTONE,Flawed plays that trial in place of the practice story.
const tryTrial = env.TRY_TRIAL ? (([story, regime, variant]) => ({ story: story!, regime: regime as "MILESTONE", variant: (variant ?? "Correct") as "Correct" }))(env.TRY_TRIAL.split(",")) : undefined;
if (tryTrial) console.warn(`[study] TRY_TRIAL: the practice trial is ${tryTrial.story} ${tryTrial.regime} ${tryTrial.variant}. Do not use for real participants.`);
if (env.SHOW_CONDITION === "1") console.warn("[study] SHOW_CONDITION=1: the UI shows each trial's regime and variant. Do not use with real participants.");
if (uid === undefined) console.warn("[sandbox] SANDBOX_UID not set: the agent and its terminal run as the server user and are NOT isolated (dev only)");

// The agent: real opencode v2 with the live model, or AGENT=fake to write the reference code (no agent UI; flow development).
const opencodeBin = env.OPENCODE_BIN ?? [path.resolve(here, "../../../node_modules/.bin/opencode"), path.resolve(here, "../node_modules/.bin/opencode")].find((p) => fs.existsSync(p)) ?? "opencode";
const agentPort = Number(env.AGENT_PORT ?? 4591);
const workRoot = env.WORK_ROOT ?? "/work";
const agentHome = env.AGENT_HOME ?? "/agent-home";

const app = await buildApp({
  participantId,
  studySeed,
  basePath: env.STUDY_SLUG && platformUser ? `/study/${env.STUDY_SLUG}/${encodeURIComponent(platformUser)}/` : "/",
  completionUrl: env.STUDY_COMPLETION_URL,
  group: env.STUDY_GROUP !== undefined ? Number(env.STUDY_GROUP) : undefined,
  // Behind Conditioner: alternates with the participant's number within their group (STUDY_CONDITION_NUMBER).
  round: env.STUDY_ROUND !== undefined ? Number(env.STUDY_ROUND) : env.STUDY_CONDITION_NUMBER !== undefined ? Number(env.STUDY_CONDITION_NUMBER) % 2 : undefined,
  exportDir,
  trialsDir,
  projectDir,
  staticDir: env.STATIC_DIR ?? path.resolve(here, "../../agent-ui/dist"),
  exitOnFinish: !demo && env.EXIT_ON_FINISH !== "0",
  demo,
  showCondition: env.SHOW_CONDITION === "1",
  tryTrial,
  // set when the image is built (Dockerfile, HARNESS_COMMIT)
  version: env.HARNESS_COMMIT || undefined,
  recording: env.SESSION_RECORDING !== "0",
  // STUDY_CONSENT=external: Conditioner's entry page collected consent before the pod started.
  externalConsent: env.STUDY_CONSENT === "external",
  proxyToken: env.STUDY_PROXY_TOKEN || undefined,
  sandbox: { uid, gid, probeUid },
  workRoot,
  // minutes; 0 = off
  limits: {
    warnMs: minutes(env.STUDY_AFK_WARN_MIN, 10),
    abortMs: minutes(env.STUDY_AFK_ABORT_MIN, 10),
    maxSessionMs: minutes(env.STUDY_MAX_SESSION_MIN, 120),
  },
  agent:
    env.AGENT === "fake"
      ? { kind: "fake" }
      : {
          kind: "opencode",
          bin: opencodeBin,
          port: agentPort,
          home: agentHome,
          live: {
            model: env.LIVE_MODEL ?? (() => { throw new Error("LIVE_MODEL is required (and LIVE_API_KEY): the model that plays the agent"); })(),
            upstream: env.LIVE_UPSTREAM ?? "https://opencode.ai/zen/go/v1",
            apiKey: env.LIVE_API_KEY ?? env.STUDY_LLM_KEY,
            port: Number(env.LIVE_PORT ?? 4592),
            checkpointPort: Number(env.CHECKPOINT_PORT ?? 4593),
          },
        },
  protectedPaths: env.ALLOW_READABLE_PATHS === "1" ? [] : [exportDir, trialsDir, path.resolve(here, ".."), ...(socketPath ? [path.dirname(socketPath)] : [])],
});

if (socketPath) {
  fs.rmSync(socketPath, { force: true });
  await app.listen({ path: socketPath });
  fs.chmodSync(socketPath, 0o666); // the directory (0700, host-owned) is what keeps the sandbox uid out
  console.log(`harness up for ${participantId} on ${socketPath}`);
} else {
  await app.listen({ host, port });
  console.log(`harness up for ${participantId} on http://${host}:${port}`);
}
