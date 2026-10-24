#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "./inspect.js";
import { record } from "./record.js";
import { synthesize } from "./synthesize.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
// npm runs workspace scripts inside capture/; paths on the command line are meant from where it was called.
const cwd = process.env.INIT_CWD ?? process.cwd();
const abs = (p: string) => path.resolve(cwd, p);
const USAGE = `beacon capture: record opencode sessions for replay in the study harness

  record --id ID --model MODEL [--seed DIR] [--upstream URL] [--out DIR] [--web] [--turns FILE] [--brief FILE]
      Starts opencode on a fresh copy of the seed project (default capture/seeds/shopfront) with MODEL behind a
      recording proxy, and opens opencode's terminal UI (--web: its web UI). Work in the session as usual and quit
      when done; the capture is written to captures/ID. The upstream is any OpenAI-compatible API (default
      https://openrouter.ai/api/v1); its key comes from CAPTURE_API_KEY. --turns sends scripted turns instead
      (a JSON array of {text, agent}). The agent's question tool is off unless --allow-questions (a replay
      could not answer it). --brief gives the agent standing instructions it follows without the person seeing
      them (capture/briefs/study.md: four numbered steps, one per response, so checkpoints fall between steps).
      Repeat it to add more (e.g. a story's step outline from capture/briefs/outlines/); they are joined in order.

  synthesize --story DIR [--seed DIR] [--out DIR]
      Turns a scripted story (capture/synthetic/<id>) into a capture.

  inspect DIR
      Lists the main thread's responses with their positions, tools and changed files.`;

function args(argv: string[]) {
  const out: Record<string, string | true> = {};
  const briefs: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) rest.push(a);
    else if (a === "--web" || a === "--allow-questions") out[a.slice(2)] = true;
    else if (a === "--brief") briefs.push(argv[++i] ?? "");
    else out[a.slice(2)] = argv[++i] ?? "";
  }
  return { out, briefs, rest };
}

const [cmd, ...argv] = process.argv.slice(2);
const { out: o, briefs, rest } = args(argv);
const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : undefined);

if (cmd === "record") {
  const id = str("id");
  const model = str("model");
  if (!id || !model) throw new Error("record needs --id and --model");
  const turnsFile = str("turns");
  const capture = await record({
    id,
    model,
    seed: abs(str("seed") ?? path.join(root, "capture/seeds/shopfront")),
    out: abs(str("out") ?? path.join(root, "captures", id)),
    upstream: str("upstream") ?? "https://openrouter.ai/api/v1",
    apiKey: process.env.CAPTURE_API_KEY,
    bin: process.env.OPENCODE_BIN ?? path.join(root, "node_modules/.bin/opencode"),
    turns: turnsFile ? JSON.parse(fs.readFileSync(abs(turnsFile), "utf8")) : undefined,
    web: o.web === true,
    allowQuestions: o["allow-questions"] === true,
    brief: briefs.length ? briefs.map((f) => fs.readFileSync(abs(f), "utf8").trim()).join("\n\n") + "\n" : undefined,
    log: (l) => console.error(`[capture] ${l}`),
  });
  console.log(`captured ${capture.calls.length} model calls, ${capture.turns.length} turns → ${str("out") ?? `captures/${id}`}`);
} else if (cmd === "synthesize") {
  const story = str("story");
  if (!story) throw new Error("synthesize needs --story");
  const id = path.basename(story);
  const out = abs(str("out") ?? path.join(root, "captures", id));
  const r = synthesize(abs(story), abs(str("seed") ?? path.join(root, "capture/seeds/shopfront")), out);
  console.log(`synthesized ${r.capture.calls.length} calls → ${out}; steps start at ${JSON.stringify(r.stepStarts)}`);
} else if (cmd === "inspect" && rest[0]) {
  console.log(inspect(abs(rest[0])));
} else {
  console.log(USAGE);
  process.exit(cmd ? 1 : 0);
}
