// The guessing check of the pilot: the understanding questions without the code. A person
// sees what every participant sees before the agent writes anything (the story and the public plan) and answers all
// questions; whatever they get right above the 25 % chance level is answerable without having understood the code.
//
// Usage: npx tsx analysis/pilot/guess-check.ts sheet SEED > sheet.md          the questionnaire, options in a seeded order
//        npx tsx analysis/pilot/guess-check.ts grade SEED:answers.txt ...      per person their sheet's seed and answers,
//                                                                         lines "US1 1 B"
// Grading uses the reference answer of the Correct variant; the flaw item is also shown against the Flawed one. The
// key of the emergent item depends on what the agent decides, so its reference answer is only one of the plausible ones.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng, parseSeed, shuffle } from "@beacon/shared";
import { makeStoryLoader } from "../../study-harness/server/src/trial.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const loadStory = makeStoryLoader(path.join(root, "study-harness/trials"), path.join(root, "study-harness/project"));
const STORIES = ["US1", "US2", "US3", "US4", "US5", "US6"];
const LETTERS = ["A", "B", "C", "D"];

const [mode, ...args] = process.argv.slice(2);
if (!(mode === "sheet" || mode === "grade") || args.length === 0 || (mode === "grade" && !args.every((a) => /^\d+:./.test(a))))
  throw new Error("usage: guess-check.ts sheet SEED | grade SEED:answers.txt ...");

// Displayed option order per story and item, drawn from the seed in story order.
const makeSheet = (seed: string) => {
  const rng = makeRng(parseSeed(seed));
  return STORIES.map((id) => {
    const story = loadStory(id);
    return { id, story, items: story.def.understanding.items.map((it) => ({ ...it, order: shuffle([0, 1, 2, 3], rng) })) };
  });
};

if (mode === "sheet") {
  const seed = args[0]!;
  const sheet = makeSheet(seed);
  const out = [
    `# Questionnaire ${seed}`,
    "",
    "Each part describes a feature that a coding agent was asked to build, and the agent's plan. You do not see the",
    "code it wrote. Answer every question with the option you think most likely, even if you have to guess: one letter",
    "per question. Do not look anything up.",
  ];
  for (const s of sheet) {
    out.push("", "---", "", `## ${s.id}: ${s.story.def.title}`, "", "**The request**", "", s.story.brief, "", "**The agent's plan**", "", s.story.publicPlan, "");
    s.items.forEach((it, k) => {
      out.push(`**${s.id} ${k + 1}.** ${it.question}`, "");
      it.order.forEach((o, i) => out.push(`- ${LETTERS[i]}) ${it.options[o]}`));
      out.push("");
    });
  }
  console.log(out.join("\n"));
} else {
  type Row = { id: string; k: number; role: string; right: boolean; rightFlawed: boolean };
  const sheet = makeSheet("0"); // questions and keys, the same for every seed
  const people = args.map((arg) => {
    const [seed, f] = [arg.slice(0, arg.indexOf(":")), arg.slice(arg.indexOf(":") + 1)];
    const mine = makeSheet(seed);
    const answers = new Map<string, number>();
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const m = line.trim().match(/^(US\d)\s+(\d)\s+([A-D])$/i);
      if (m) answers.set(`${m[1]!.toUpperCase()} ${m[2]}`, LETTERS.indexOf(m[3]!.toUpperCase()));
    }
    const rows: Row[] = mine.flatMap((s) =>
      s.items.map((it, k) => {
        const shown = answers.get(`${s.id} ${k + 1}`);
        if (shown === undefined) throw new Error(`${f}: no answer for ${s.id} ${k + 1}`);
        const picked = it.order[shown]!;
        return { id: s.id, k: k + 1, role: it.role, right: picked === it.correct.Correct, rightFlawed: picked === it.correct.Flawed };
      }),
    );
    return { file: path.basename(f), rows };
  });

  // One-sided binomial test against chance (25 %).
  const pAbove = (x: number, n: number) => {
    let p = 0;
    for (let i = x; i <= n; i++) {
      let c = 1;
      for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
      p += c * 0.25 ** i * 0.75 ** (n - i);
    }
    return p;
  };
  const share = (rows: Row[]) => `${rows.filter((r) => r.right).length}/${rows.length}`;
  const all = people.flatMap((p) => p.rows);
  const x = all.filter((r) => r.right).length;
  console.log(`Correct overall: ${share(all)} (${Math.round((100 * x) / all.length)} %, chance 25 %, one-sided p = ${pAbove(x, all.length).toFixed(3)})`);
  for (const p of people) console.log(`  ${p.file}: ${share(p.rows)}`);
  console.log("\nBy role:");
  for (const role of [...new Set(all.map((r) => r.role))]) console.log(`  ${role.padEnd(10)} ${share(all.filter((r) => r.role === role))}`);
  console.log("\nBy item (✓ right, · wrong; flaw item: Correct key / Flawed key). Flagged: right for everyone.");
  for (const s of sheet)
    s.items.forEach((it, k) => {
      const rs = people.map((p) => p.rows.find((r) => r.id === s.id && r.k === k + 1)!);
      const marks = rs.map((r) => (r.right ? "✓" : "·")).join("");
      const flawed = it.role === "flaw" ? ` / ${rs.map((r) => (r.rightFlawed ? "✓" : "·")).join("")}` : "";
      const flag = rs.every((r) => r.right) ? "  ← check: answerable without the code" : "";
      console.log(`  ${s.id} ${k + 1} ${it.role.padEnd(10)} ${marks}${flawed}${flag}`);
    });
}
