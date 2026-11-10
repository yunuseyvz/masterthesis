import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chownTree, type SandboxOptions } from "./sandbox.js";

/** Dependencies of the shared project, installed at image build time. Absent in dev and in tests. */
const NODE_MODULES_SRC = process.env.NODE_MODULES_SRC ?? "/opt/shopfront/node_modules";

/**
 * A fresh project folder for one trial: the shared project as every trial starts, committed to git so that
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
  const opts = { ...gitOpts(dir, sandbox), stdio: "ignore" as const };
  execFileSync("git", ["add", "-A"], opts);
  execFileSync("git", ["-c", "core.hooksPath=/dev/null", "commit", "-q", "--allow-empty", "-m", message], opts);
}

/**
 * git in a trial's project runs as the repository's owner (git refuses repositories of other users). The participant
 * controls that repository (hooks, config), so git gets none of the server's environment, which holds the model's key.
 */
const gitOpts = (dir: string, sandbox: SandboxOptions) => ({ cwd: dir, ...(sandbox.uid !== undefined ? { uid: sandbox.uid, gid: sandbox.gid ?? sandbox.uid } : {}), env: { PATH: process.env.PATH, HOME: dir } });

const git = (dir: string, sandbox: SandboxOptions, args: string[]) => execFileSync("git", args, { ...gitOpts(dir, sandbox), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

/**
 * A file of the project, or undefined if it is not a regular file or its owner may not read it. The server runs as
 * root and the participant controls the project (a link to /proc/1/environ, a directory swapped for a link, a named
 * pipe), so the owner reads it, not the server.
 */
function readProjectFile(dir: string, rel: string, sandbox: SandboxOptions): string | undefined {
  const abs = path.join(dir, rel);
  try {
    if (!fs.lstatSync(abs).isFile()) return undefined;
    if (sandbox.uid === undefined) return fs.readFileSync(abs, "utf8");
    return execFileSync("cat", ["--", abs], { ...gitOpts(dir, sandbox), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 5_000, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
}

/** The project's files as they are now (tracked and new, without ignored ones such as node_modules). */
export function readWorkspace(dir: string, sandbox: SandboxOptions): Map<string, string> {
  const files = git(dir, sandbox, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean);
  const out = new Map<string, string>();
  for (const rel of new Set(files)) {
    const content = readProjectFile(dir, rel, sandbox);
    if (content !== undefined) out.set(rel, content);
  }
  return out;
}

/**
 * What is not committed yet: every changed, new or deleted file with its committed and its current content. This is
 * what opencode's changes view shows, and in a live trial it is the code under review.
 */
export function uncommitted(dir: string, sandbox: SandboxOptions): { path: string; before: string; after: string }[] {
  const changed = git(dir, sandbox, ["diff", "-z", "--name-only", "HEAD"]).split("\0");
  const added = git(dir, sandbox, ["ls-files", "-z", "--others", "--exclude-standard"]).split("\0");
  return [...new Set([...changed, ...added].filter(Boolean))].sort().map((rel) => {
    let before = "";
    try {
      before = git(dir, sandbox, ["show", `HEAD:${rel}`]);
    } catch { /* new file */ }
    return { path: rel, before, after: readProjectFile(dir, rel, sandbox) ?? "" };
  });
}
