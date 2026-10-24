import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chownTree, type SandboxOptions } from "./sandbox.js";

/** Dependencies of the shared project, installed at image build time. Absent in dev and in tests. */
const NODE_MODULES_SRC = process.env.NODE_MODULES_SRC ?? "/opt/shopfront/node_modules";

/**
 * A fresh project folder for one trial: the project as the captured session found it, committed to git so that
 * opencode shows the agent's work as changes. The agent (opencode, as the sandbox uid) writes into it.
 */
export function createTrialWorkspace(root: string, key: string, files: Map<string, string>, sandbox: SandboxOptions): string {
  const dir = path.join(root, key);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, content] of files) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  if (!files.has(".gitignore")) fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules\n");
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=study", "-c", "user.email=study@local", ...args], { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-qm", "Initial commit");
  // Finished steps are committed under the agent's name (see commitWorkspace).
  git("config", "user.name", "Coding agent");
  git("config", "user.email", "agent@shopfront.local");
  chownTree(dir, sandbox);
  // Linked after the chown walk, which would otherwise follow the link into the shared install.
  if (fs.existsSync(NODE_MODULES_SRC)) fs.symlinkSync(NODE_MODULES_SRC, path.join(dir, "node_modules"));
  return dir;
}

/**
 * Commits everything in a trial's project, as the sandbox uid (the owner of the repository), under the agent's name.
 * The study does this at checkpoints so that opencode's changes view shows only the work since the last one.
 */
export function commitWorkspace(dir: string, message: string, sandbox: SandboxOptions) {
  const opts = { cwd: dir, stdio: "ignore" as const, ...(sandbox.uid !== undefined ? { uid: sandbox.uid, gid: sandbox.gid ?? sandbox.uid } : {}), env: { ...process.env, HOME: dir } };
  execFileSync("git", ["add", "-A"], opts);
  execFileSync("git", ["commit", "-q", "--allow-empty", "-m", message], opts);
}
