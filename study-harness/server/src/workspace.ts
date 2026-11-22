import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chownTree, type SandboxOptions } from "./sandbox.js";

// installed at image build time; absent in dev and tests
const NODE_MODULES_SRC = process.env.NODE_MODULES_SRC ?? "/opt/shopfront/node_modules";

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
  git("config", "user.name", "Coding agent");
  git("config", "user.email", "agent@shopfront.local");
  chownTree(dir, sandbox);
  // Linked after the chown walk, which would otherwise follow the link into the shared install.
  if (fs.existsSync(NODE_MODULES_SRC)) fs.symlinkSync(NODE_MODULES_SRC, path.join(dir, "node_modules"));
  return dir;
}

export function commitWorkspace(dir: string, message: string, sandbox: SandboxOptions) {
  const opts = { ...gitOpts(dir, sandbox), stdio: "ignore" as const };
  execFileSync("git", ["add", "-A"], opts);
  execFileSync("git", ["-c", "core.hooksPath=/dev/null", "commit", "-q", "--allow-empty", "-m", message], opts);
}

// git gets none of the server's env (it holds the model key): the participant controls the repo's hooks and config
const gitOpts = (dir: string, sandbox: SandboxOptions) => ({ cwd: dir, ...(sandbox.uid !== undefined ? { uid: sandbox.uid, gid: sandbox.gid ?? sandbox.uid } : {}), env: { PATH: process.env.PATH, HOME: dir } });

const git = (dir: string, sandbox: SandboxOptions, args: string[]) => execFileSync("git", args, { ...gitOpts(dir, sandbox), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

// Read as the file's owner, not root: the participant controls the project (symlinks to /proc/1/environ, swapped dirs, pipes).
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

export function readWorkspace(dir: string, sandbox: SandboxOptions): Map<string, string> {
  const files = git(dir, sandbox, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean);
  const out = new Map<string, string>();
  for (const rel of new Set(files)) {
    const content = readProjectFile(dir, rel, sandbox);
    if (content !== undefined) out.set(rel, content);
  }
  return out;
}

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
