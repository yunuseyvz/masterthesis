import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Snapshots of a project folder in a git directory of their own, next to (not inside) the project: the session's
 * own git use is untouched, and `node_modules` and the project's `.git` are left out. One commit per snapshot.
 */
export class Snapshots {
  constructor(
    readonly workDir: string,
    readonly gitDir: string,
  ) {
    fs.mkdirSync(gitDir, { recursive: true });
    this.git("init", "-q");
    fs.mkdirSync(path.join(gitDir, "info"), { recursive: true });
    fs.writeFileSync(path.join(gitDir, "info", "exclude"), "node_modules\n.git\n");
  }

  private git(...args: string[]): string {
    return execFileSync("git", [`--git-dir=${this.gitDir}`, `--work-tree=${this.workDir}`, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_NAME: "capture", GIT_AUTHOR_EMAIL: "capture@beacon", GIT_COMMITTER_NAME: "capture", GIT_COMMITTER_EMAIL: "capture@beacon" },
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  }

  /** Records the folder as it is now and returns the commit id. */
  take(label: string): string {
    this.git("add", "-A");
    this.git("commit", "-q", "--allow-empty", "--no-verify", "-m", label);
    return this.git("rev-parse", "HEAD");
  }

  /** Writes every snapshot into one git bundle file. */
  bundle(file: string) {
    this.git("bundle", "create", "-q", file, "--all");
  }
}
