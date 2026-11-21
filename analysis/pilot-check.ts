// The pilot's checks on its exports (docs/study/pilot-plan.md): session length, how hard each understanding item is,
// and how long people stay without input, to check the limits of "Are you still there?" (STUDY_AFK_WARN_MIN).
//
// Usage: npx tsx analysis/pilot-check.ts EXPORT_DIR
// Reads EXPORT_DIR/trials.csv and EXPORT_DIR/*.events.jsonl. The practice feature is not in trials.csv, so the item
// table has the six measured features; the inactivity table covers the whole session.
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("usage: pilot-check.ts EXPORT_DIR");

type Event = { t: number; type: string; data: Record<string, unknown> };
const logs = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".events.jsonl"))
  .map((f) => ({ file: f, events: fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Event) }));

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const min = (ms: number) => (ms / 60000).toFixed(1);

// 1. Session length, from the first session_start to Finish.
console.log("== Sessions (minutes from start to Finish)");
for (const { file, events } of logs) {
  const start = events.find((e) => e.type === "session_start");
  const end = events.find((e) => e.type === "finish") ?? events.find((e) => e.type === "session_abandoned");
  console.log(`  ${file.padEnd(28)} ${start && end ? min(end.t - start.t) : "?"}${end?.type === "session_abandoned" ? `  abandoned (${end.data.reason})` : ""}`);
}

// 2. Items: share correct, confidence and time per story and item, flagged when everyone or nobody got it right.
const csv = path.join(dir, "trials.csv");
if (fs.existsSync(csv)) {
  const [head, ...lines] = fs.readFileSync(csv, "utf8").trim().split("\n");
  const cols = head!.split(",");
  const rows = lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])) as Record<string, string>);
  const nItems = cols.filter((c) => /^u\d+_correct$/.test(c)).length;
  type Item = { story: string; k: number; role: string; regime: string; correct: boolean; confidence: number; ms: number };
  const items: Item[] = rows.flatMap((r) =>
    Array.from({ length: nItems }, (_, i) => ({
      story: r.story!, k: i + 1, role: r[`u${i + 1}_role`]!, regime: r.regime!,
      correct: r[`u${i + 1}_correct`] === "true", confidence: Number(r[`u${i + 1}_confidence`]), ms: Number(r[`u${i + 1}_ms`]),
    })),
  );
  const pct = (xs: Item[]) => `${Math.round((100 * xs.filter((x) => x.correct).length) / xs.length)} %`.padStart(5);
  console.log(`\n== Items (${new Set(rows.map((r) => r.participant_id)).size} people, ${rows.length} trials)`);
  console.log("  story item role        n  correct  confidence  median s");
  for (const story of [...new Set(items.map((x) => x.story))].sort())
    for (let k = 1; k <= nItems; k++) {
      const xs = items.filter((x) => x.story === story && x.k === k);
      const right = xs.filter((x) => x.correct).length;
      const flag = xs.length >= 3 && (right === 0 || right === xs.length) ? `  ← ${right === 0 ? "nobody" : "everyone"} right` : "";
      const conf = Math.round(xs.reduce((a, x) => a + x.confidence, 0) / xs.length);
      console.log(`  ${story}   ${k}    ${xs[0]!.role.padEnd(10)} ${String(xs.length).padStart(2)}  ${pct(xs)}    ${String(conf).padStart(3)} %     ${(median(xs.map((x) => x.ms)) / 1000).toFixed(0).padStart(4)}${flag}`);
    }
  console.log("\n  By role and regime (share correct):");
  const regimes = ["BATCH", "MILESTONE", "NON_MILESTONE"];
  console.log(`  ${"role".padEnd(10)} ${regimes.map((r) => r.padStart(14)).join("")}`);
  for (const role of [...new Set(items.map((x) => x.role))])
    console.log(`  ${role.padEnd(10)} ${regimes.map((g) => { const xs = items.filter((x) => x.role === role && x.regime === g); return (xs.length ? `${pct(xs)} (${xs.length})` : "–").padStart(14); }).join("")}`);
}

// 3. Stretches without input while the participant is to act. The client reports `idle` after 30 s without input and
// again at the next input, so a stretch runs from 30 s before the first report to the second. Like the watchdog, it
// counts from the start of the page it ends on (a *_shown event, the start, or the end of the final review), and not
// while the agent works.
const PAGE_START = (type: string) => type.endsWith("_shown") || type === "session_start" || type === "reviewed" || type === "stage1_submit";
type Stretch = { phase: string; ms: number };
const stretches: Stretch[] = [];
let prompts = 0;
for (const { events } of logs) {
  let pageStart = 0;
  let idleSince: number | null = null;
  for (const e of events) {
    if (PAGE_START(e.type)) pageStart = e.t;
    if (e.type === "afk_prompt") prompts++;
    if (e.type !== "ui_idle") continue;
    if (e.data.idle === true) idleSince = e.t - 30000;
    else if (idleSince !== null) {
      const phase = String(e.data.phase);
      if (phase !== "working") stretches.push({ phase, ms: e.t - Math.max(idleSince, pageStart) });
      idleSince = null;
    }
  }
}
console.log(`\n== Without input, while the participant is to act ("Are you still there?" shown ${prompts}×)`);
console.log("  phase          stretches ≥ 1 min  ≥ 5 min  ≥ 10 min  longest (min)");
for (const phase of [...new Set(stretches.map((s) => s.phase))].sort()) {
  const ms = stretches.filter((s) => s.phase === phase).map((s) => s.ms);
  const n = (limit: number) => String(ms.filter((m) => m >= limit * 60000).length).padStart(8);
  console.log(`  ${phase.padEnd(14)} ${n(1).padStart(18)} ${n(5)} ${n(10)}  ${min(Math.max(...ms)).padStart(12)}`);
}
