import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chownTree, killUserProcesses, type SandboxOptions } from "./sandbox.js";

export interface TestRunResult {
  passed: number;
  failed: number;
  tests: { name: string; ok: boolean }[];
}

interface ExecResult {
  stdout: string;
  code: number | null;
  timedOut: boolean;
}

// Runs as `uid` (if set) in a private temp dir with an empty env; everything the uid still runs is killed afterwards.
async function runNode(files: Map<string, string>, args: string[], timeoutMs: number, uid?: number): Promise<ExecResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "run-"));
  try {
    for (const [rel, content] of files) {
      const abs = path.join(dir, rel);
      if (!abs.startsWith(dir + path.sep)) continue;
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    if (uid !== undefined) chownTree(dir, { uid, gid: uid });
    return await new Promise<ExecResult>((resolve) => {
      const child = spawn(process.execPath, args, { cwd: dir, env: {}, stdio: ["ignore", "pipe", "ignore"], ...(uid !== undefined ? { uid, gid: uid } : {}) });
      let stdout = "";
      let timedOut = false;
      child.stdout.on("data", (d) => (stdout += d));
      // A process the code started can hold stdout open after the child is gone, so kill the whole uid.
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
        if (uid !== undefined) killUserProcesses(uid);
      }, timeoutMs);
      child.on("error", () => {
        clearTimeout(timer);
        resolve({ stdout, code: null, timedOut });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, code, timedOut });
      });
    });
  } finally {
    if (uid !== undefined) killUserProcesses(uid);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  }
}

// two steps can be reported at once, and a run's end kills the uid's processes
let lastRun: Promise<unknown> = Promise.resolve();

function execNode(files: Map<string, string>, args: string[], timeoutMs = 10_000, uid?: number): Promise<ExecResult> {
  if (uid === undefined) return runNode(files, args, timeoutMs);
  const run = lastRun.then(() => runNode(files, args, timeoutMs, uid));
  lastRun = run.catch(() => {});
  return run;
}

export async function runTests(workspace: Map<string, string>, testFile: string): Promise<TestRunResult> {
  const { stdout, timedOut } = await execNode(workspace, ["--test", "--test-reporter=tap", testFile]);
  const tests = [...stdout.matchAll(/^(not )?ok \d+ - (.+?)(?: #.*)?$/gm)].map((m) => ({ name: m[2]!, ok: !m[1] }));
  if (timedOut) return { passed: 0, failed: Math.max(tests.length, 1), tests };
  const passed = tests.filter((t) => t.ok).length;
  return { passed, failed: tests.length - passed, tests };
}

export async function runProbe(workspace: Map<string, string>, script: string, timeoutMs = 10_000, sandbox: SandboxOptions = {}): Promise<string | null> {
  const ws = new Map(workspace);
  ws.set("__probe.ts", script);
  const { stdout, code, timedOut } = await execNode(ws, ["__probe.ts"], timeoutMs, sandbox.probeUid);
  return code === 0 && !timedOut ? stdout.trim() : null;
}
