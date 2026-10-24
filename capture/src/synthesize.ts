import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CAPTURE_FORMAT, Capture, threadKey, type Call, type Chunk } from "@beacon/shared";
import { Snapshots } from "./snapshots.js";

/**
 * A scripted story (capture/synthetic/<id>/story.json): what a run should look like, step by step. `synthesize` turns
 * it into a capture in the same format a real session produces, with timing modelled on a streaming model, so the
 * harness treats both alike. The Correct variant is the one written; the harness's trial defines the Flawed one as
 * a patch.
 */
interface ScriptedFile {
  path: string;
  source?: string | { Correct: string; Flawed: string };
  edits?: { find: string; replace: string }[];
}
interface ScriptedStory {
  id: string;
  title: string;
  brief: string;
  steps: { n: number; summary: string; narration?: string; files: ScriptedFile[] }[];
  plan: { explore: { text?: string; tools: { name: string; args: Record<string, unknown> }[] }[]; file: string };
  testFile: string;
}

/** What the scripted agent says and does in one model response. */
interface Response {
  text?: string;
  tools: { name: string; args: Record<string, unknown> }[];
  /** File changes the tools make (applied before the next response). */
  effects?: (ws: Map<string, string>) => void;
}

const APPROVE = "The plan looks good. Go ahead.";
const DONE = "That's everything. The feature is finished.";

/** Streaming model timing: a pause before the first token, ~300 characters/s of text, tool arguments a bit faster. */
const THINK_MS = 700;
const TEXT_STEP = { chars: 12, ms: 40 };
const toolMs = (chars: number) => Math.min(4000, 400 + chars);

function chunksFor(index: number, r: Response, promptTokens: number): Chunk[] {
  const out: Chunk[] = [];
  const id = `chatcmpl-synthetic-${index}`;
  const ev = (delta: object, finish: string | null = null, extra: object = {}) =>
    JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model: "synthetic", choices: [{ index: 0, delta, finish_reason: finish }], ...extra });
  let t = THINK_MS;
  out.push({ t, data: ev({ role: "assistant", content: "" }) });
  const text = r.text ?? "";
  for (let i = 0; i < text.length; i += TEXT_STEP.chars) {
    t += TEXT_STEP.ms;
    out.push({ t, data: ev({ content: text.slice(i, i + TEXT_STEP.chars) }) });
  }
  r.tools.forEach((tool, k) => {
    const args = JSON.stringify(tool.args);
    t += 20;
    out.push({ t, data: ev({ tool_calls: [{ index: k, id: `call_${index}_${k}`, type: "function", function: { name: tool.name, arguments: "" } }] }) });
    const pieces = Math.max(1, Math.ceil(args.length / 48));
    const dt = toolMs(args.length) / pieces;
    for (let p = 0; p < pieces; p++) {
      t += dt;
      out.push({ t: Math.round(t), data: ev({ tool_calls: [{ index: k, function: { arguments: args.slice(p * 48, (p + 1) * 48) } }] }) });
    }
  });
  t += 20;
  const completion = Math.ceil((text.length + r.tools.reduce((n, x) => n + JSON.stringify(x.args).length, 0)) / 4);
  out.push({ t: Math.round(t), data: ev({}, r.tools.length ? "tool_calls" : "stop", { usage: { prompt_tokens: promptTokens, completion_tokens: completion, total_tokens: promptTokens + completion } }) });
  out.push({ t: Math.round(t), data: "[DONE]" });
  return out;
}

function readTree(root: string, rel = "", out = new Map<string, string>()) {
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name === ".git") continue;
    if (e.isDirectory()) readTree(root, r, out);
    else out.set(r, fs.readFileSync(path.join(root, r), "utf8"));
  }
  return out;
}

function applyEdit(content: string | undefined, e: { find: string; replace: string }, where: string) {
  if (content === undefined) throw new Error(`${where}: edit of a missing file`);
  const at = content.indexOf(e.find);
  if (at < 0 || content.indexOf(e.find, at + 1) >= 0) throw new Error(`${where}: edit text must occur exactly once: ${JSON.stringify(e.find.slice(0, 60))}`);
  return content.slice(0, at) + e.replace + content.slice(at + e.find.length);
}

/** The scripted run as model responses, per turn. */
function responses(story: ScriptedStory, dir: string): Response[][] {
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
  const plan: Response[] = [...story.plan.explore.map((e) => ({ text: e.text, tools: e.tools })), { text: read(story.plan.file).trim(), tools: [] }];
  const build: Response[] = [];
  for (const st of story.steps) {
    const tools: Response["tools"] = [];
    const effects: ((ws: Map<string, string>) => void)[] = [];
    for (const f of st.files) {
      if (f.source !== undefined) {
        const content = read(typeof f.source === "string" ? f.source : f.source.Correct);
        tools.push({ name: "write", args: { path: f.path, content } });
        effects.push((ws) => ws.set(f.path, content));
      } else {
        for (const e of f.edits ?? []) {
          tools.push({ name: "edit", args: { path: f.path, oldString: e.find, newString: e.replace } });
          effects.push((ws) => ws.set(f.path, applyEdit(ws.get(f.path), e, `${story.id} step ${st.n} ${f.path}`)));
        }
      }
    }
    build.push({ text: st.narration ?? `${st.summary}.`, tools, effects: (ws) => effects.forEach((fx) => fx(ws)) });
    // Once the tests exist, the agent runs them, as a real agent would.
    if (st.files.some((f) => f.path === story.testFile)) build.push({ text: "Running the tests.", tools: [{ name: "shell", args: { command: `node --test ${story.testFile}` } }] });
  }
  build.push({ text: DONE, tools: [] });
  return [plan, build];
}

export interface SynthesizeResult {
  capture: Capture;
  /** Main-thread position of the first response of each scripted step (the step boundaries for a trial). */
  stepStarts: Record<number, number>;
}

export function synthesize(storyDir: string, seed: string, out: string): SynthesizeResult {
  const story = JSON.parse(fs.readFileSync(path.join(storyDir, "story.json"), "utf8")) as ScriptedStory;
  const workspaceDir = `/synthetic/${story.id}`;
  const turns = [{ text: story.brief, agent: "plan", at: 0 }, { text: APPROVE, agent: "build", at: 0 }];
  const mainThread = threadKey({ messages: [{ role: "user", content: story.brief }], tools: [{}] }, workspaceDir);

  // Snapshots are taken of a scratch folder that goes through the same states as the real project would.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `synth-${story.id}-`));
  const work = path.join(scratch, "project");
  const ws = readTree(seed);
  ws.set(".gitignore", ws.get(".gitignore") ?? "node_modules\n");
  const writeAll = () => {
    fs.rmSync(work, { recursive: true, force: true });
    for (const [p, c] of ws) {
      fs.mkdirSync(path.dirname(path.join(work, p)), { recursive: true });
      fs.writeFileSync(path.join(work, p), c);
    }
  };
  writeAll();
  const snapshots = new Snapshots(work, path.join(scratch, "snapshots.git"));
  const initial = snapshots.take("initial");

  const calls: Call[] = [];
  const stepStarts: Record<number, number> = {};
  let at = 0;
  const [planTurn, buildTurn] = responses(story, storyDir);
  // Steps start at the responses carrying a step's narration (build turn, in order).
  const narrations = story.steps.map((s) => s.narration ?? `${s.summary}.`);
  for (const [k, turn] of [planTurn!, buildTurn!].entries()) {
    turns[k]!.at = at;
    for (const r of turn) {
      const index = calls.length;
      const step = k === 1 ? narrations.indexOf(r.text ?? "") : -1;
      if (step >= 0 && stepStarts[story.steps[step]!.n] === undefined) stepStarts[story.steps[step]!.n] = index;
      writeAll();
      const chunks = chunksFor(index, r, 4000 + index * 600);
      calls.push({
        index,
        thread: mainThread,
        position: index,
        at,
        request: { model: "synthetic", stream: true, tools: ["read", "glob", "grep", "write", "edit", "shell"], messages: 1 + index * 2, preview: "" },
        status: 200,
        chunks,
        snapshot: snapshots.take(`call ${index}`),
      });
      r.effects?.(ws);
      at += chunks.at(-1)!.t + 300 * r.tools.length;
    }
  }
  writeAll();
  const final = snapshots.take("final");

  const capture = Capture.parse({
    format: CAPTURE_FORMAT,
    id: story.id,
    createdAt: new Date().toISOString(),
    source: "synthetic",
    model: { id: "synthetic" },
    workspace: { dir: workspaceDir, initial, final },
    mainThread,
    turns,
    calls,
  });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "capture.json"), JSON.stringify(capture, null, 1) + "\n");
  snapshots.bundle(path.resolve(out, "history.bundle"));
  fs.rmSync(scratch, { recursive: true, force: true });
  return { capture, stepStarts };
}
