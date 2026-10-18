import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
if (!env.PARTICIPANT_ID || !env.STUDY_SEED) throw new Error("PARTICIPANT_ID and STUDY_SEED are required");

const exportDir = env.EXPORT_DIR ?? "/exports";
const corpusDir = env.CORPUS_DIR ?? path.resolve(here, "../corpus");
const uid = env.SANDBOX_UID !== undefined ? Number(env.SANDBOX_UID) : undefined;
const gid = env.SANDBOX_GID !== undefined ? Number(env.SANDBOX_GID) : uid;
const socketPath = env.LISTEN_SOCKET;

if (uid === undefined) console.warn("[sandbox] SANDBOX_UID not set: terminal runs as the server user and is NOT isolated (dev only)");

const app = buildApp({
  participantId: env.PARTICIPANT_ID,
  studySeed: env.STUDY_SEED,
  group: env.STUDY_GROUP !== undefined ? Number(env.STUDY_GROUP) : undefined,
  exportDir,
  corpusDir,
  staticDir: env.STATIC_DIR ?? path.resolve(here, "../../client/dist"),
  devFallbackStory: env.DEV_FALLBACK_STORY,
  exitOnFinish: env.EXIT_ON_FINISH !== "0",
  sandbox: { uid, gid },
  protectedPaths: env.ALLOW_READABLE_PATHS === "1" ? [] : [exportDir, corpusDir, path.resolve(here, ".."), ...(socketPath ? [path.dirname(socketPath)] : [])],
});

if (socketPath) {
  fs.rmSync(socketPath, { force: true });
  await app.listen({ path: socketPath });
  fs.chmodSync(socketPath, 0o666); // the directory (0700, host-owned) is what keeps the sandbox uid out
  console.log(`harness up for ${env.PARTICIPANT_ID} on ${socketPath}`);
} else {
  await app.listen({ host: "127.0.0.1", port: 5185 });
  console.log(`harness up for ${env.PARTICIPANT_ID} on http://localhost:5185`);
}
