import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as pty from "node-pty";
import type { StudySession } from "./machine.js";

const RC = `PS1='\\[\\e[2m\\]\${PROJECT_NAME}\\[\\e[0m\\] \\$ '
alias ls='ls --color=auto'
alias ll='ls -la'
clear
`;

const PREFILL = "npm test";

export interface SandboxOptions {
  /** Unprivileged uid/gid the shell runs as. Unset = dev mode: the shell shares the server's identity (NOT isolated). */
  uid?: number;
  gid?: number;
}

export interface TerminalConn {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

/**
 * One real bash (in a pty) per checkpoint, working on throwaway copies of the files the participant
 * can see. The isolation boundary is the container plus a separate unprivileged uid that cannot read
 * the harness code, corpus or exports (see assertUnreadable).
 */
export class TerminalManager {
  private current: { key: string; proc: pty.IPty; dir: string; onExit: () => void } | null = null;

  constructor(
    private readonly session: StudySession,
    private readonly sandbox: SandboxOptions,
    private readonly root = path.join(os.tmpdir(), "beacon-sandbox"),
  ) {
    fs.mkdirSync(this.root, { recursive: true, mode: 0o755 });
    fs.writeFileSync(this.rcFile, RC, { mode: 0o644 });
  }

  private get rcFile() {
    return path.join(this.root, "bashrc");
  }

  /** Call after every session transition: drops the shell once its checkpoint is no longer on screen. */
  sync() {
    const ctx = this.session.terminalContext();
    if (this.current && ctx?.key !== this.current.key) this.dispose();
  }

  open(size: { cols: number; rows: number }, onData: (d: string) => void, onExit: () => void): TerminalConn | null {
    const ctx = this.session.terminalContext();
    if (!ctx) return null;
    this.dispose();

    const dir = fs.mkdtempSync(path.join(this.root, "ws-"));
    const { uid, gid } = this.sandbox;
    const own = (p: string) => uid !== undefined && fs.chownSync(p, uid, gid ?? uid);
    for (const [rel, content] of ctx.files) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    // chown the whole tree (dirs + files) after writing
    const walk = (p: string) => {
      own(p);
      if (fs.statSync(p).isDirectory()) for (const e of fs.readdirSync(p)) walk(path.join(p, e));
    };
    walk(dir);
    fs.chmodSync(dir, 0o700);

    const bin = [path.dirname(process.execPath), "/usr/local/bin", "/usr/bin", "/bin"].join(":");
    const proc = pty.spawn(
      "/bin/bash",
      ["-c", `ulimit ${uid !== undefined ? "-u 128 " : ""}-n 256 -t 600 -f 10240; exec /bin/bash --noprofile --rcfile ${this.rcFile} -i`],
      {
        name: "xterm-256color",
        cols: size.cols,
        rows: size.rows,
        cwd: dir,
        uid,
        gid: gid ?? uid,
        env: {
          PATH: bin,
          HOME: dir,
          PROJECT_NAME: ctx.project,
          TERM: "xterm-256color",
          LANG: "C.UTF-8",
          npm_config_update_notifier: "false",
          npm_config_fund: "false",
          npm_config_audit: "false",
        },
      },
    );

    const entry = { key: ctx.key, proc, dir, onExit };
    this.current = entry;
    this.session.recordTerminalOpen();
    // Type the usual test command at the first prompt (not executed). Mirror it in the line buffer
    // so that pressing Enter is logged and counted as a test run.
    let line = "";
    let prefilled = false;
    proc.onData((d) => {
      onData(d);
      if (!prefilled && d.includes(ctx.project)) {
        prefilled = true;
        setTimeout(() => {
          proc.write(PREFILL);
          line = PREFILL;
        }, 40);
      }
    });
    proc.onExit(() => {
      if (this.current === entry) this.dispose();
      onExit();
    });

    return {
      write: (data) => {
        for (const ch of data.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")) {
          if (ch === "\r" || ch === "\n") {
            if (line.trim()) this.session.recordTerminalCommand(line.trim());
            line = "";
          } else if (ch === "\x7f" || ch === "\b") line = line.slice(0, -1);
          else if (ch === "\x03" || ch === "\x15") line = "";
          else if (ch >= " ") line += ch;
        }
        proc.write(data);
      },
      resize: (cols, rows) => {
        if (cols > 0 && rows > 0) proc.resize(Math.min(cols, 400), Math.min(rows, 200));
      },
      close: () => {
        if (this.current === entry) this.dispose();
      },
    };
  }

  dispose() {
    const c = this.current;
    if (!c) return;
    this.current = null;
    try { c.proc.kill("SIGKILL"); } catch { /* already gone */ }
    fs.rmSync(c.dir, { recursive: true, force: true });
    c.onExit();
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
