import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

/**
 * Writes `files` to a throwaway directory and runs node there. The container
 * (--network none, non-root) is the real sandbox; this adds isolation between runs
 * and a wall-clock timeout.
 */
async function execNode(files: Map<string, string>, args: string[], timeoutMs = 10_000): Promise<ExecResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "run-"));
  try {
    for (const [rel, content] of files) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    return await new Promise<ExecResult>((resolve) => {
      const child = spawn(process.execPath, args, { cwd: dir, env: {}, stdio: ["ignore", "pipe", "ignore"] });
      let stdout = "";
      let timedOut = false;
      child.stdout.on("data", (d) => (stdout += d));
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, code, timedOut });
      });
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export async function runTests(workspace: Map<string, string>, testFile: string): Promise<TestRunResult> {
  const { stdout, timedOut } = await execNode(workspace, ["--test", "--test-reporter=tap", testFile]);
  const tests = [...stdout.matchAll(/^(not )?ok \d+ - (.+?)(?: #.*)?$/gm)].map((m) => ({ name: m[2]!, ok: !m[1] }));
  if (timedOut) return { passed: 0, failed: Math.max(tests.length, 1), tests };
  const passed = tests.filter((t) => t.ok).length;
  return { passed, failed: tests.length - passed, tests };
}

/** Executes the probe script against the workspace and returns its trimmed stdout. */
export async function runProbe(workspace: Map<string, string>, script: string): Promise<string | null> {
  const ws = new Map(workspace);
  ws.set("__probe.ts", script);
  const { stdout, code, timedOut } = await execNode(ws, ["__probe.ts"]);
  return code === 0 && !timedOut ? stdout.trim() : null;
}
