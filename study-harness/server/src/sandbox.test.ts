import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runProbe } from "./runner.js";
import { assertProbeRuns } from "./sandbox.js";
import { commitWorkspace, createTrialWorkspace, readWorkspace, uncommitted } from "./workspace.js";

// Changing users needs root, which the study server has in its container. Elsewhere these tests are skipped.
const asRoot = process.getuid?.() === 0;
const sandbox = { uid: 61234, gid: 61234, probeUid: 61235 };
const OWNER = { uid: 61234, gid: 61234, env: { PATH: process.env.PATH, HOME: "/tmp" } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-test-"));
fs.chmodSync(tmp, 0o755);
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** A file only root can read, like the trials and /proc/1/environ in the container. */
function secretFile() {
  const dir = fs.mkdtempSync(path.join(tmp, "secret-"));
  fs.writeFileSync(path.join(dir, "secret"), "THE-SECRET");
  fs.chmodSync(dir, 0o700);
  return path.join(dir, "secret");
}

function project(key: string) {
  const dir = createTrialWorkspace(tmp, key, new Map([["src/a.ts", "export const a = 1;\n"]]), sandbox);
  /** What the participant's terminal can do: anything as the repository's owner. */
  const asOwner = (file: string, ...args: string[]) => execFileSync(file, args, { ...OWNER, cwd: dir, stdio: "ignore" });
  return { dir, asOwner };
}

/** Whether the probe user can run this node (not when it lives in a private home; in the image it can). */
const probeRuns = asRoot && (() => {
  try {
    assertProbeRuns(sandbox);
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(probeRuns)("grading the participant's code", () => {
  it("runs as the probe user, which cannot read the server's secrets, in a directory the terminal cannot read", async () => {
    const secret = secretFile();
    const script = `
      import fs from "node:fs";
      const denied = (f) => { try { fs.readFileSync(f); return false; } catch { return true; } };
      console.log(JSON.stringify({ uid: process.getuid(), groups: process.getgroups(), env: Object.keys(process.env).length, secret: denied(${JSON.stringify(secret)}), environ: denied("/proc/1/environ"), mode: (fs.statSync(".").mode & 0o777).toString(8) }));
    `;
    const out = JSON.parse((await runProbe(new Map(), script, 10_000, sandbox))!);
    // getgroups always includes the effective group: the point is that root's groups are gone.
    expect(out).toEqual({ uid: 61235, groups: [61235], env: 0, secret: true, environ: true, mode: "700" });
  });

  it("does not hang on a process the graded code leaves behind, and kills it", async () => {
    const script = `
      import { spawn } from "node:child_process";
      spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "inherit" }).unref();
      console.log("started");
    `;
    const started = Date.now();
    expect(await runProbe(new Map(), script, 1_000, sandbox)).toBeNull();
    expect(Date.now() - started).toBeLessThan(5_000);
    // Still running as that user; a killed orphan stays a zombie (state Z) until the container's first process reaps it.
    const status = (p: string) => {
      try {
        return fs.readFileSync(`/proc/${p}/status`, "utf8");
      } catch {
        return "";
      }
    };
    const running = () => fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p) && /^Uid:\s+61235\b/m.test(status(p)) && !/^State:\s+Z/m.test(status(p)));
    await new Promise((r) => setTimeout(r, 100));
    expect(running()).toEqual([]);
  });

  it("takes grading runs in turn, so that the end of one does not kill the next", async () => {
    const script = `await new Promise((r) => setTimeout(r, 200)); console.log("done");`;
    expect(await Promise.all([runProbe(new Map(), script, 5_000, sandbox), runProbe(new Map(), script, 5_000, sandbox), runProbe(new Map(), script, 5_000, sandbox)])).toEqual(["done", "done", "done"]);
  });
});

describe.runIf(asRoot)("the participant's project", () => {
  it("does not read through links", () => {
    const secret = secretFile();
    const { dir, asOwner } = project("links");
    asOwner("ln", "-s", secret, "link.txt");
    // A tracked path below a directory that is then swapped for a link.
    fs.mkdirSync(path.join(dir, "swap"));
    fs.chownSync(path.join(dir, "swap"), 61234, 61234);
    asOwner("sh", "-c", `echo x > swap/secret && git add swap/secret && rm -r swap && ln -s ${path.dirname(secret)} swap`);
    const files = readWorkspace(dir, sandbox);
    expect(files.get("src/a.ts")).toBe("export const a = 1;\n");
    expect(files.has("link.txt")).toBe(false);
    expect(files.has("swap/secret")).toBe(false);
    expect(JSON.stringify(uncommitted(dir, sandbox))).not.toContain("THE-SECRET");
  });

  it("does not hang on a named pipe", () => {
    const { dir, asOwner } = project("pipe");
    asOwner("mkfifo", "pipe");
    expect(readWorkspace(dir, sandbox).has("pipe")).toBe(false);
    expect(uncommitted(dir, sandbox).find((d) => d.path === "pipe")?.after ?? "").toBe("");
  });

  it("gives git none of the server's environment, even for a command the project configures", () => {
    const { dir, asOwner } = project("hook");
    const leak = path.join(dir, "leak.txt");
    const hook = path.join(dir, ".git", "hooks", "pre-commit");
    fs.writeFileSync(hook, `#!/bin/sh\nenv > ${leak}\n`, { mode: 0o755 });
    fs.chownSync(hook, 61234, 61234);
    asOwner("sh", "-c", `git config core.fsmonitor ".git/hooks/pre-commit"; echo b > b.txt`);
    process.env.LIVE_API_KEY = "THE-KEY";
    try {
      commitWorkspace(dir, "step", sandbox);
    } finally {
      delete process.env.LIVE_API_KEY;
    }
    expect(fs.readFileSync(leak, "utf8")).toContain("HOME="); // the project's command did run
    expect(fs.readFileSync(leak, "utf8")).not.toContain("THE-KEY");
  });

  it("does not run a commit hook", () => {
    const { dir } = project("commit-hook");
    const marker = path.join(dir, "ran.txt");
    const hook = path.join(dir, ".git", "hooks", "pre-commit");
    fs.writeFileSync(hook, `#!/bin/sh\ntouch ${marker}\nexit 1\n`, { mode: 0o755 });
    fs.chownSync(hook, 61234, 61234);
    commitWorkspace(dir, "step", sandbox);
    expect(fs.existsSync(marker)).toBe(false);
  });
});
