import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { assistantCount, messageText } from "./calls.js";
import { APPROVE } from "./machine.js";
import { loadReference } from "./reference.js";
import { projectDir, trialsDir } from "./test-paths.js";
import { loadStory } from "./trial.js";

// A live trial through the real opencode v2 binary, with a scripted model in place of the real one (slow; needs the
// binary). Enable with OPENCODE_IT=1.
const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.resolve(here, "../../../node_modules/.bin/opencode");

/** The scripted agent's question after a rejection. */
const ASK = "What would you like me to change?";

type Body = { stream?: boolean; tools?: { function?: { name?: string } }[]; messages?: { role?: string; content?: unknown }[] };

/**
 * A model that plays the practice story as the Drehbuch asks: the plan, then per step one response that writes the
 * step's files (the reference implementation's), and after steps 1-3 a call of the checkpoint tool.
 */
function scriptedModel(brief: string, approval: string, steps: Map<string, string>[], feedback?: { text: string; fix: Map<string, string> }) {
  const requests: Body[] = [];
  const script: ({ text: string } | { tools: { name: string; args: object }[] })[] = [];
  steps.forEach((files, k) => {
    script.push({ tools: [...files].map(([p, content]) => ({ name: "write", args: { path: p, content } })) });
    if (k < 3) script.push({ tools: [{ name: "review_checkpoint", args: { step: k + 1 } }] });
  });
  script.push({ text: "Done." });
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}") as Body;
      requests.push(body);
      const first = messageText(body.messages?.find((m) => m.role === "user" && !messageText(m).startsWith("<system-reminder>")));
      const main = (body.tools?.length ?? 0) > 0 && first === brief;
      // Before the approval every answer is the plan; after it, the script goes on by the responses since then.
      const at = (body.messages ?? []).findIndex((m) => m.role === "user" && messageText(m) === approval);
      // A rejection: the agent asks what to change and ends its turn. The answer: the fix and the step's checkpoint
      // call again come in before the rest of the script.
      const msgs = body.messages ?? [];
      const rejected = msgs.at(-1)?.role === "tool" && messageText(msgs.at(-1)).includes("rejected this step");
      const responses = (from: number, to?: number) => assistantCount({ messages: msgs.slice(from, to) }, [ASK]);
      const fb = feedback ? msgs.findIndex((m) => m.role === "user" && messageText(m) === feedback.text) : -1;
      const before = fb < 0 ? Infinity : responses(at, fb);
      const played = fb < 0 ? script : [...script.slice(0, before), { tools: [...feedback!.fix].map(([p, content]) => ({ name: "write", args: { path: p, content } })) }, { tools: [{ name: "review_checkpoint", args: { step: 2 } }] }, ...script.slice(before)];
      const step = !main ? { text: "Practice" } : at < 0 ? { text: "Plan: four steps." } : rejected ? { text: ASK } : (played[responses(at)] ?? { text: "Done." });
      const ev = (delta: object, finish: string | null = null) => `data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: "scripted", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      if (!body.stream) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "scripted", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "text" in step ? step.text : "" } }] }));
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(ev({ role: "assistant", content: "" }));
      res.write(ev({ reasoning_content: "REASONING-MARKER" }));
      if ("text" in step) res.write(ev({ content: step.text }));
      else step.tools.forEach((t, i) => res.write(ev({ tool_calls: [{ index: i, id: `call_${requests.length}_${i}`, type: "function", function: { name: t.name, arguments: JSON.stringify(t.args) } }] })));
      res.write(ev({}, "text" in step ? "stop" : "tool_calls"));
      res.end("data: [DONE]\n\n");
    });
  });
  return new Promise<{ url: string; requests: Body[]; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, requests, close: () => server.close() })),
  );
}

/** The study server on the repository's trials, with a Drehbuch for the practice story and the scripted model behind it. */
async function setup(name: string, port: number, feedback?: { text: string; fix: (steps: Map<string, string>[]) => Map<string, string> }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "oc-live-"));
  const trials = path.join(tmp, "trials");
  fs.cpSync(trialsDir, trials, { recursive: true });
  const def = JSON.parse(fs.readFileSync(path.join(trials, "US0", "trial.json"), "utf8"));
  def.outline = { Correct: "outline.md", Flawed: "outline.md" };
  fs.writeFileSync(path.join(trials, "US0", "trial.json"), JSON.stringify(def));
  fs.writeFileSync(path.join(trials, "US0", "outline.md"), "## Step outline: greeting\n\nOUTLINE-MARKER\n");

  const story = loadStory(trials, projectDir, "US0");
  const ref = loadReference(story);
  const steps = [1, 2, 3, 4].map((k) => ref.step("Correct", k));
  const fix = feedback?.fix(steps);
  const model = await scriptedModel(story.brief, APPROVE, steps, feedback && { text: feedback.text, fix: fix! });
  const app = await buildApp({
    participantId: name, studySeed: "3", group: 0, trialsDir: trials, projectDir,
    exportDir: path.join(tmp, "exports"), workRoot: path.join(tmp, "work"), exitOnFinish: false, sandbox: {},
    agent: { kind: "opencode", bin, port: port + 1, home: path.join(tmp, "home"), live: { upstream: model.url, model: "scripted", port: port + 2, checkpointPort: port + 3 } },
  });
  const dir = path.join(tmp, "work", name, "00-US0");
  const post = async (payload: unknown) => (await app.inject({ method: "POST", url: "/_study/action", payload: payload as object })).json();
  await post({ type: "begin" });
  const view = await post({ type: "presurvey", consent: true, demographics: { ageGroup: "25-34", programmingYears: "3-5", aiAssistantUse: "weekly", codeReviewFrequency: "weekly", tsFamiliarity: 4 }, ncs: [4, 3, 2, 2, 5, 4], attention: 4, stias: [5, 5, 4] });
  return {
    tmp, story, steps, fix, model, dir, post, view, app,
    git: (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim(),
    /** Paths not committed yet. */
    open: () => execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: dir, encoding: "utf8" }).split("\n").filter(Boolean).map((l) => l.slice(3)).sort(),
    events: () => fs.readFileSync(path.join(tmp, "exports", `${name}_3.events.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { type: string; data: any }),
    close: async () => {
      await app.close();
      model.close();
    },
  };
}

describe.skipIf(process.env.OPENCODE_IT !== "1")("live trial through opencode", () => {
  it("plays the practice story live: the checkpoint tool commits steps, holds the scored one, and grades the code as played", async () => {
    const { tmp, story, steps, model, dir, post, git, open, events: readEvents, close, view: started } = await setup("LIVE", 4790);
    try {
      let view = started;
      expect(view.phase).toBe("plan");

      // The practice trial pauses after its milestone, step 2: step 1 is committed, step 2 is what the review shows.
      view = await post({ type: "approvePlan" });
      expect(view.phase).toBe("stage1");
      expect(git("log", "--format=%s")).toBe(`${story.def.steps[0]!.summary}\nInitial commit`);
      expect(open()).toEqual([...steps[1]!.keys()].sort());

      // The tool is offered directly once opencode has connected to it (after the first request); the Drehbuch is in
      // the main conversation, never in opencode's files.
      const main = model.requests.filter((r) => r.tools?.length);
      expect(main.at(-1)!.tools!.map((t) => t.function?.name)).toContain("review_checkpoint");
      expect(messageText(main[0]!.messages!.find((m) => m.role === "system"))).toContain("OUTLINE-MARKER");
      const leaked = (() => {
        try {
          return execFileSync("grep", ["-rl", "OUTLINE-MARKER", path.join(tmp, "home"), dir], { encoding: "utf8" });
        } catch {
          return ""; // grep exits 1 when nothing matches
        }
      })();
      expect(leaked).toBe("");

      // The public plan is what opencode got and what the model sees from now on; its own plan and its reasoning are gone.
      const seenAfter = main.at(-1)!.messages!.map(messageText).join("\n");
      expect(seenAfter).toContain(story.publicPlan);
      expect(seenAfter).not.toContain("Plan: four steps.");
      const stored = (marker: string) => {
        try {
          return execFileSync("grep", ["-rl", marker, path.join(tmp, "home")], { encoding: "utf8" });
        } catch {
          return "";
        }
      };
      expect(stored("REASONING-MARKER")).toBe("");
      expect(stored("Plan: four steps.")).toBe("");
      expect(readEvents().find((e) => e.type === "live_plan_public")!.data).toMatchObject({ reason: "the model's plan", draft: "Plan: four steps." });

      await post({ type: "stage1", decision: "accept" });
      view = await post({ type: "stage2", probeAnswer: 0, final: "confirm" });
      expect(view.phase).toBe("reviewing");
      expect(git("log", "--format=%s").split("\n")).toHaveLength(3);
      for (const files of steps) for (const [p, content] of files) expect(fs.readFileSync(path.join(dir, p), "utf8"), p).toBe(content);

      await post({ type: "reviewed" });
      view = await post({ type: "understanding", answers: [0, 0, 0, 0, 0], confidences: [55, 55, 55, 55, 55], paas: 5, itemMs: [1, 1, 1, 1, 1], answerChanges: [0, 0, 0, 0, 0] });
      const events = readEvents();
      expect(events.filter((e) => e.type === "live_checkpoint").map((e) => [e.data.step, e.data.held])).toEqual([[1, false], [2, true], [3, false]]);
      // The answer key comes from running the code as played: here the reference code, so its documented answers.
      const key = events.find((e) => e.type === "live_key")!.data.understanding as string[];
      expect(key).toEqual(story.def.understanding.items.map((it) => it.options[it.correct.Correct]));
    } finally {
      await close();
    }
  }, 180_000);

  it("after a rejection, the agent asks; the participant's one composer message reaches it, and it fixes the step and goes on", async () => {
    const text = "Greet people by their first name only.";
    const { steps, fix, model, post, git, open, app, events: readEvents, close } = await setup("FIX", 4794, {
      text,
      // The fix: the step's first file, changed.
      fix: (steps) => new Map([[[...steps[1]!.keys()][0]!, steps[1]!.values().next().value + "\n// fixed after review\n"]]),
    });
    try {
      expect((await post({ type: "approvePlan" })).phase).toBe("stage1");
      await post({ type: "stage1", decision: "reject" });
      let view = await post({ type: "stage2", probeAnswer: 0, final: "confirm" });
      expect(view.phase).toBe("feedback");
      // Only the answer gets through, once: a prompt before it is not the agent's session, and a second one is refused.
      const prompt = (payload: object) => app.inject({ method: "POST", url: `/api/session/${view.agentSessionId}/prompt`, payload });
      expect((await app.inject({ method: "POST", url: "/api/session/ses_other/prompt", payload: { text } })).statusCode).toBe(403);
      expect((await prompt({ text })).statusCode).toBeLessThan(300);
      expect((await prompt({ text: "again" })).statusCode).toBe(403);
      for (let i = 0; i < 100 && view.phase !== "reviewing"; i++) {
        await new Promise((r) => setTimeout(r, 200));
        view = (await app.inject({ url: "/_study/state" })).json();
      }
      expect(view.phase).toBe("reviewing");

      // The agent asked after the rejection, and the answer reached it as the participant's own message.
      const last = model.requests.at(-1)!.messages!;
      const at = last.findIndex((m) => m.role === "user" && messageText(m) === text);
      expect(at).toBeGreaterThan(0);
      expect(messageText(last[at - 1])).toBe(ASK);
      expect(messageText(last[at - 2])).toContain("rejected this step");

      // The fix is committed with step 2; the final look shows steps 3 and 4 only.
      expect(git("log", "--format=%s").split("\n")).toHaveLength(3);
      const [fixed, content] = [...fix!][0]!;
      expect(git("show", `HEAD:${fixed}`) + "\n").toBe(content);
      expect(open()).toEqual([...new Set([...steps[2]!.keys(), ...steps[3]!.keys()])].sort());

      const events = readEvents();
      expect(events.filter((e) => e.type === "live_checkpoint").map((e) => [e.data.step, e.data.held])).toEqual([[1, false], [2, true], [2, false], [3, false]]);
      expect(events.find((e) => e.type === "feedback_submit")!.data).toMatchObject({ text });
    } finally {
      await close();
    }
  }, 180_000);
});
