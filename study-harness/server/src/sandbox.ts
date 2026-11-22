import { execFileSync } from "node:child_process";
import fs from "node:fs";

export interface SandboxOptions {
  // opencode's uid (and the terminal's); unset = dev mode, not isolated
  uid?: number;
  gid?: number;
  // runs the trial's code for grading; unset = server user
  probeUid?: number;
}

// Linux only; the container has no pkill
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

// test -r exits 0 if the uid CAN read the path
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

// otherwise every probe fails and every answer counts as wrong
export function assertProbeRuns(sandbox: SandboxOptions) {
  if (sandbox.probeUid === undefined) return;
  try {
    execFileSync(process.execPath, ["--version"], { uid: sandbox.probeUid, gid: sandbox.probeUid, stdio: "ignore" });
  } catch {
    throw new Error(`uid ${sandbox.probeUid} cannot run ${process.execPath}; refusing to start`);
  }
}

export function chownTree(dir: string, sandbox: SandboxOptions) {
  const { uid, gid } = sandbox;
  if (uid === undefined) return;
  const walk = (p: string) => {
    fs.lchownSync(p, uid, gid ?? uid);
    if (fs.lstatSync(p).isDirectory()) for (const e of fs.readdirSync(p)) walk(`${p}/${e}`);
  };
  walk(dir);
}
