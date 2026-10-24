import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
if (!env.PARTICIPANT_ID || !env.STUDY_SEED) throw new Error("PARTICIPANT_ID and STUDY_SEED are required");
// The ID is used in export file names, so reject anything that could escape the export directory.
if (!/^[A-Za-z0-9]{1,32}$/.test(env.PARTICIPANT_ID)) throw new Error(`PARTICIPANT_ID must be 1-32 letters/digits, got "${env.PARTICIPANT_ID}"`);

const exportDir = env.EXPORT_DIR ?? "/exports";
const trialsDir = env.TRIALS_DIR ?? path.resolve(here, "../../trials");
const capturesDir = env.CAPTURES_DIR ?? path.resolve(here, "../../../captures");
const uid = env.SANDBOX_UID !== undefined ? Number(env.SANDBOX_UID) : undefined;
const gid = env.SANDBOX_GID !== undefined ? Number(env.SANDBOX_GID) : uid;
// An empty LISTEN_SOCKET falls back to TCP on LISTEN_HOST:PORT (e.g. behind a reverse proxy).
const socketPath = env.LISTEN_SOCKET || undefined;
const host = env.LISTEN_HOST ?? "127.0.0.1";
const port = Number(env.PORT ?? 5185);

const demo = env.DEMO === "1";
if (demo) console.warn("[study] DEMO=1: after Finish the harness starts a fresh session instead of exiting. Do not use for real participants.");
if (env.SHOW_CONDITION === "1") console.warn("[study] SHOW_CONDITION=1: the UI shows each trial's regime and variant. Do not use with real participants.");
if (uid === undefined) console.warn("[sandbox] SANDBOX_UID not set: the agent and its terminal run as the server user and are NOT isolated (dev only)");

// The agent: real opencode v2 by default, or AGENT=fake to play the replay without opencode (no agent UI).
const opencodeBin = env.OPENCODE_BIN ?? [path.resolve(here, "../../../node_modules/.bin/opencode"), path.resolve(here, "../node_modules/.bin/opencode")].find((p) => fs.existsSync(p)) ?? "opencode";
const agentPort = Number(env.AGENT_PORT ?? 4591);
const workRoot = env.WORK_ROOT ?? "/work";
const agentHome = env.AGENT_HOME ?? "/agent-home";

const app = await buildApp({
  participantId: env.PARTICIPANT_ID,
  studySeed: env.STUDY_SEED,
  group: env.STUDY_GROUP !== undefined ? Number(env.STUDY_GROUP) : undefined,
  exportDir,
  trialsDir,
  capturesDir,
  staticDir: env.STATIC_DIR ?? path.resolve(here, "../../agent-ui/dist"),
  exitOnFinish: !demo && env.EXIT_ON_FINISH !== "0",
  demo,
  showCondition: env.SHOW_CONDITION === "1",
  recording: env.SESSION_RECORDING !== "0",
  sandbox: { uid, gid },
  workRoot,
  replayPace: env.REPLAY_PACE !== undefined ? Number(env.REPLAY_PACE) : 1,
  agent:
    env.AGENT === "fake"
      ? { kind: "fake" }
      : {
          kind: "opencode",
          bin: opencodeBin,
          port: agentPort,
          replayPort: Number(env.REPLAY_PORT ?? 4590),
          home: agentHome,
        },
  protectedPaths: env.ALLOW_READABLE_PATHS === "1" ? [] : [exportDir, trialsDir, capturesDir, path.resolve(here, ".."), ...(socketPath ? [path.dirname(socketPath)] : [])],
});

if (socketPath) {
  fs.rmSync(socketPath, { force: true });
  await app.listen({ path: socketPath });
  fs.chmodSync(socketPath, 0o666); // the directory (0700, host-owned) is what keeps the sandbox uid out
  console.log(`harness up for ${env.PARTICIPANT_ID} on ${socketPath}`);
} else {
  await app.listen({ host, port });
  console.log(`harness up for ${env.PARTICIPANT_ID} on http://${host}:${port}`);
}
