import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Capture, parseChunks } from "@beacon/shared";

/** A readable outline of a capture: the main thread's responses with their positions, for choosing checkpoints. */
export function inspect(dir: string): string {
  const c = Capture.parse(JSON.parse(fs.readFileSync(path.join(dir, "capture.json"), "utf8")));
  const lines: string[] = [];
  lines.push(`${c.id} (${c.source}, model ${c.model.id}${c.opencodeVersion ? `, opencode ${c.opencodeVersion}` : ""})`);
  lines.push(`${c.calls.length} model calls, ${new Set(c.calls.map((x) => x.thread)).size} threads; main thread ${c.mainThread}`);
  lines.push("");
  const turnAt = c.turns.map((t) => t.at);
  const main = c.calls.filter((x) => x.thread === c.mainThread);
  // Files that change between consecutive snapshots, from the bundle (when git can read it).
  const changed = (from: string, to: string) => {
    try {
      return execFileSync("git", ["diff", "--name-only", from, to], { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_DIR: path.join(dir, ".inspect.git") } }).trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  };
  const gitDir = path.join(dir, ".inspect.git");
  let canDiff = false;
  try {
    fs.rmSync(gitDir, { recursive: true, force: true });
    execFileSync("git", ["clone", "-q", "--bare", path.join(dir, "history.bundle"), gitDir], { stdio: "ignore" });
    canDiff = true;
  } catch { /* no git or no bundle */ }
  let turn = -1;
  main.forEach((call, k) => {
    while (turn + 1 < turnAt.length && turnAt[turn + 1]! <= call.at) {
      turn++;
      lines.push(`── turn ${turn} (${c.turns[turn]!.agent ?? "?"}): ${c.turns[turn]!.text.replace(/\s+/g, " ").slice(0, 100)}`);
    }
    const r = parseChunks(call.chunks);
    const dur = call.chunks.at(-1)?.t ?? 0;
    const tools = r.tools.map((t) => {
      let arg = "";
      try {
        const a = JSON.parse(t.args) as Record<string, unknown>;
        arg = String(a.path ?? a.command ?? a.pattern ?? "");
      } catch { /* partial */ }
      return `${t.name}(${arg})`;
    });
    const next = main[k + 1]?.snapshot ?? c.workspace.final;
    const files = canDiff ? changed(call.snapshot, next) : [];
    lines.push(`@${String(call.position).padStart(3)}  ${(dur / 1000).toFixed(1).padStart(5)}s  ${r.text.replace(/\s+/g, " ").slice(0, 90)}`);
    if (tools.length) lines.push(`         tools: ${tools.join(", ")}`);
    if (files.length) lines.push(`         changes: ${files.join(", ")}`);
  });
  if (canDiff) fs.rmSync(gitDir, { recursive: true, force: true });
  lines.push("");
  // The plan names the steps too; only the responses after the plan was approved (turn 1 on) announce them.
  const built = main.filter((call) => call.at >= (c.turns[1]?.at ?? 0));
  lines.push(...proposeSteps(built.map((call) => ({ position: call.position, text: parseChunks(call.chunks).text }))));
  lines.push("A checkpoint at @N stops the replay before the response at position N (after every earlier tool call ran).");
  return lines.join("\n");
}

/**
 * Step starts from the agent's "Step N: ..." sentences (what capture/briefs/study.md asks for): the first response
 * that announces step N starts it. Warns when a response announces two steps, which no checkpoint could separate.
 */
export function proposeSteps(responses: { position: number; text: string }[]): string[] {
  const starts = new Map<number, { position: number; title: string }>();
  const warnings: string[] = [];
  for (const r of responses) {
    const found = [...r.text.matchAll(/(?:^|\n)\W*Step ([1-4])\W*[:.\-–]\s*([^\n]*)/gi)].map((m) => ({ n: Number(m[1]), title: m[2]!.trim() }));
    const fresh = found.filter((f) => !starts.has(f.n));
    if (new Set(fresh.map((f) => f.n)).size > 1) warnings.push(`@${r.position} announces steps ${fresh.map((f) => f.n).join(", ")} in one response`);
    for (const f of fresh) if (!starts.has(f.n)) starts.set(f.n, { position: r.position, title: f.title });
  }
  if (!starts.size) return [];
  const steps = [1, 2, 3, 4].map((n) => (starts.get(n) ? { n, start: starts.get(n)!.position, summary: starts.get(n)!.title.replace(/\.$/, "") } : null));
  const out = ["Proposed steps (from the agent's \"Step N:\" sentences):"];
  for (const s of steps) out.push(s ? `  { "n": ${s.n}, "kind": "?", "summary": ${JSON.stringify(s.summary)}, "start": ${s.start} },` : "  (a step was never announced)");
  const ok = steps.every((s, i) => s && (i === 0 || s.start > steps[i - 1]!.start));
  if (!ok) out.push("  warning: the announced steps are missing or out of order; choose the starts by hand");
  for (const w of warnings) out.push(`  warning: ${w}`);
  out.push("");
  return out;
}
