import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Capture, type Call } from "@beacon/shared";

/**
 * A capture made by the capture tool (capture/): `capture.json` and the workspace snapshots in `history.bundle`.
 * The harness only reads captures; it never changes them.
 */
export interface LoadedCapture {
  dir: string;
  capture: Capture;
  /** Responses of the main thread (the session the person drove), by position. */
  main: Call[];
  /** Files of a snapshot (commit), as a path → content map. */
  files(commit: string): Map<string, string>;
}

const cache = new Map<string, LoadedCapture>();

export function loadCapture(dir: string): LoadedCapture {
  const hit = cache.get(dir);
  if (hit) return hit;
  const capture = Capture.parse(JSON.parse(fs.readFileSync(path.join(dir, "capture.json"), "utf8")));
  const main = capture.calls.filter((c) => c.thread === capture.mainThread).sort((a, b) => a.position - b.position || a.index - b.index);
  // One response per position: a retried request (same position) was answered the same way, keep the first good one.
  const byPosition = new Map<number, Call>();
  for (const c of main) if (!byPosition.has(c.position) || (byPosition.get(c.position)!.status !== 200 && c.status === 200)) byPosition.set(c.position, c);

  // The bundle is unpacked once per process into a bare repository.
  let gitDir: string | null = null;
  const git = (args: string[], input?: string) => {
    if (!gitDir) {
      gitDir = fs.mkdtempSync(path.join(os.tmpdir(), `capture-${capture.id}-`));
      execFileSync("git", ["clone", "-q", "--bare", path.join(dir, "history.bundle"), gitDir], { stdio: "ignore" });
    }
    return execFileSync("git", [`--git-dir=${gitDir}`, ...args], { input, maxBuffer: 256 * 1024 * 1024 });
  };
  const snapshots = new Map<string, Map<string, string>>();
  const files = (commit: string) => {
    const known = snapshots.get(commit);
    if (known) return known;
    // ls-tree for the blob ids, then every blob in one cat-file call.
    const entries = git(["ls-tree", "-r", "-z", commit]).toString("utf8").split("\0").filter(Boolean).map((l) => {
      const [meta, p] = l.split("\t") as [string, string];
      return { id: meta.split(" ")[2]!, path: p };
    });
    const out = new Map<string, string>();
    const data = git(["cat-file", "--batch"], entries.map((e) => e.id).join("\n") + "\n");
    let at = 0;
    for (const e of entries) {
      const nl = data.indexOf(10, at);
      const size = Number(data.subarray(at, nl).toString("utf8").split(" ")[2]);
      out.set(e.path, data.subarray(nl + 1, nl + 1 + size).toString("utf8"));
      at = nl + 1 + size + 1;
    }
    snapshots.set(commit, out);
    return out;
  };

  const loaded: LoadedCapture = { dir, capture, main: [...byPosition.values()], files };
  cache.set(dir, loaded);
  return loaded;
}
