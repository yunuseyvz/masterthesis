import { execFileSync } from "node:child_process";
import fs from "node:fs";

export interface SandboxOptions {
  /** Unprivileged uid/gid that opencode (and so the participant's terminal) runs as. Unset = dev mode: NOT isolated. */
  uid?: number;
  gid?: number;
}

/** Sends SIGKILL to every process owned by `uid` (Linux only; the container has no pkill). */
export function killUserProcesses(uid: number) {
  let pids: string[] = [];
  try { pids = fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p)); } catch { return; }
  for (const pid of pids) {
    try {
      const m = /^Uid:\s+(\d+)/m.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"));
      if (m && Number(m[1]) === uid) process.kill(Number(pid), "SIGKILL");
    } catch { /* process vanished */ }
  }
}

/**
 * Fails loudly if the sandbox uid can read anything that holds ground truth.
 * Run as the sandbox uid via `test -r`; exit status 0 means it CAN read the path.
 */
export function assertUnreadable(paths: string[], sandbox: SandboxOptions) {
  if (sandbox.uid === undefined) return;
  for (const p of paths) {
    let readable = false;
    try {
      execFileSync("test", ["-r", p], { uid: sandbox.uid, gid: sandbox.gid ?? sandbox.uid, stdio: "ignore" });
      readable = true;
    } catch { /* non-zero exit: not readable, which is what we want */ }
    if (readable) throw new Error(`sandbox uid ${sandbox.uid} can read ${p}; refusing to start (chmod 700 it, or set ALLOW_READABLE_PATHS=1 to override)`);
  }
}

/** Recursively hands a directory to the sandbox uid (no-op in dev mode). */
export function chownTree(dir: string, sandbox: SandboxOptions) {
  const { uid, gid } = sandbox;
  if (uid === undefined) return;
  const walk = (p: string) => {
    fs.lchownSync(p, uid, gid ?? uid);
    if (fs.lstatSync(p).isDirectory()) for (const e of fs.readdirSync(p)) walk(`${p}/${e}`);
  };
  walk(dir);
}
