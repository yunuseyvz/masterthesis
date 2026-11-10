import { execFileSync } from "node:child_process";
import fs from "node:fs";

export interface SandboxOptions {
  /** Unprivileged uid/gid that opencode (and so the participant's terminal) runs as. Unset = dev mode: NOT isolated. */
  uid?: number;
  gid?: number;
  /** Unprivileged uid (and gid) that runs the trial's code for grading (see runner.ts); not the terminal's. Unset = the server user. */
  probeUid?: number;
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
 * Fails loudly if the sandbox uid or the probe uid can read anything that holds ground truth.
 * Run as that uid via `test -r`; exit status 0 means it CAN read the path.
 */
export function assertUnreadable(paths: string[], sandbox: SandboxOptions) {
  const users = [...(sandbox.uid !== undefined ? [{ uid: sandbox.uid, gid: sandbox.gid ?? sandbox.uid }] : []), ...(sandbox.probeUid !== undefined ? [{ uid: sandbox.probeUid, gid: sandbox.probeUid }] : [])];
  for (const user of users) {
    for (const p of paths) {
      let readable = false;
      try {
        execFileSync("test", ["-r", p], { ...user, stdio: "ignore" });
        readable = true;
      } catch { /* non-zero exit: not readable, which is what we want */ }
      if (readable) throw new Error(`uid ${user.uid} can read ${p}; refusing to start (chmod 700 it, or set ALLOW_READABLE_PATHS=1 to override)`);
    }
  }
}

/** Fails loudly if the probe uid cannot run node: every probe would fail, and every answer would count as wrong. */
export function assertProbeRuns(sandbox: SandboxOptions) {
  if (sandbox.probeUid === undefined) return;
  try {
    execFileSync(process.execPath, ["--version"], { uid: sandbox.probeUid, gid: sandbox.probeUid, stdio: "ignore" });
  } catch {
    throw new Error(`uid ${sandbox.probeUid} cannot run ${process.execPath}; refusing to start`);
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
