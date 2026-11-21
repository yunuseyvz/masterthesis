import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { CHECKPOINT_TOOL, CONTINUE, type CheckpointHandler } from "./checkpoint.js";
import { chownTree, type SandboxOptions } from "./sandbox.js";

export interface AgentHost {
  startSession(opts: { dir: string; title: string; agent: string }): Promise<{ id: string }>;
  runTurn(sessionId: string, text: string, agent?: string): Promise<void>;
  waitIdle(sessionId: string): Promise<void>;
  // synthetic opencode message: the chat does not show it
  nudge(sessionId: string, text: string): Promise<void>;
  forwardPrompt(sessionId: string, query: string, body: string): Promise<{ status: number; body: string }>;
  proxy(): { url: string; authorization: string } | undefined;
  close(): void;
}

export interface OpencodeOptions {
  bin: string;
  port: number;
  live: { url: string; model: string; checkpointUrl: string };
  home: string;
  sandbox: SandboxOptions;
  log: (type: string, data: unknown) => void;
}

// streaming noise; everything else goes into the event log
const NOISY = /delta|\.part\.|heartbeat|stream/i;

// runs as the sandbox uid, so its tools and the participant's terminal cannot read trials or exports
export class OpencodeHost implements AgentHost {
  private proc: ChildProcess | null = null;
  private password = "";
  private local = "";
  private abort = new AbortController();

  constructor(private readonly o: OpencodeOptions) {}

  async start() {
    const { home, sandbox } = this.o;
    const config = path.join(home, ".config", "opencode");
    fs.mkdirSync(config, { recursive: true });
    // Global config so no opencode file lands in the project; the sandbox uid can read it, so nothing here may reveal the condition.
    const live = this.o.live;
    // the plan agent allows questions, so deny per agent too
    const permissions = [
      { action: "question", resource: "*", effect: "deny" },
      { action: CHECKPOINT_TOOL, resource: "*", effect: "allow" },
    ];
    fs.writeFileSync(
      path.join(config, "opencode.jsonc"),
      JSON.stringify(
        {
          providers: { live: { name: "Study agent", package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: live.url, apiKey: "live" }, models: { [live.model]: { name: "Study agent" } } } },
          model: `live/${live.model}`,
          permissions,
          agents: { plan: { permissions }, build: { permissions } },
          // direct tool, not via Code Mode; a held call may wait as long as a review takes
          mcp: { servers: { review: { type: "remote", url: live.checkpointUrl, oauth: false, codemode: false, timeout: { execution: 4 * 60 * 60 * 1000 } } } },
        },
        null,
        2,
      ),
    );
    chownTree(home, sandbox);
    const env: NodeJS.ProcessEnv = {
      PATH: [path.dirname(process.execPath), "/usr/local/bin", "/usr/bin", "/bin"].join(":"),
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, ".config"),
      XDG_DATA_HOME: path.join(home, ".local", "share"),
      XDG_STATE_HOME: path.join(home, ".local", "state"),
      XDG_CACHE_HOME: path.join(home, ".cache"),
      LANG: "C.UTF-8",
      TERM: "xterm-256color",
      NEXT_TELEMETRY_DISABLED: "1",
      npm_config_update_notifier: "false",
    };
    const args = ["serve", "--port", String(this.o.port), "--hostname", "127.0.0.1"];
    // Drop privileges with setpriv so the supplementary groups are cleared as well.
    const [file, argv] =
      sandbox.uid === undefined
        ? [this.o.bin, args]
        : ["/usr/bin/setpriv", ["--reuid", String(sandbox.uid), "--regid", String(sandbox.gid ?? sandbox.uid), "--clear-groups", "--no-new-privs", this.o.bin, ...args]];
    this.proc = spawn(file, argv, { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
    this.local = `http://127.0.0.1:${this.o.port}`;
    this.password = await new Promise<string>((resolve, reject) => {
      let out = "";
      const timer = setTimeout(() => reject(new Error(`opencode did not start: ${out.slice(-500)}`)), 30_000);
      const onData = (d: Buffer) => {
        out += d.toString();
        const m = /server password (\S+)/.exec(out);
        if (m && /listening/.test(out)) { clearTimeout(timer); resolve(m[1]!); }
      };
      this.proc!.stdout!.on("data", onData);
      this.proc!.stderr!.on("data", onData);
      this.proc!.on("exit", (code) => { clearTimeout(timer); reject(new Error(`opencode exited (${code}): ${out.slice(-500)}`)); });
    });
    void this.followEvents();
    return this;
  }

  private async api(method: string, p: string, body?: unknown) {
    const res = await fetch(this.local + p, {
      method,
      headers: { authorization: "Basic " + Buffer.from(`opencode:${this.password}`).toString("base64"), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`opencode ${method} ${p}: ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }

  private async followEvents() {
    try {
      const res = await fetch(`${this.local}/api/event`, {
        headers: { authorization: "Basic " + Buffer.from(`opencode:${this.password}`).toString("base64") },
        signal: this.abort.signal,
      });
      const reader = res.body!.getReader();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += new TextDecoder().decode(value);
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
          if (!data) continue;
          try {
            const ev = JSON.parse(data);
            const type = String(ev.type ?? ev._tag ?? "event");
            if (!NOISY.test(type)) this.o.log(`agent_${type}`, ev);
          } catch { /* not JSON */ }
        }
      }
    } catch { /* stream closed */ }
  }

  async startSession({ dir, title, agent }: { dir: string; title: string; agent: string }) {
    const model = { id: this.o.live.model, providerID: "live" };
    const r = (await this.api("POST", "/api/session", { title, agent, model, location: { directory: dir } })) as { data: { id: string } };
    return { id: r.data.id };
  }

  async runTurn(sessionId: string, text: string, agent?: string) {
    if (agent) await this.api("POST", `/api/session/${sessionId}/agent`, { agent });
    await this.api("POST", `/api/session/${sessionId}/prompt`, { text });
    await this.waitIdle(sessionId);
  }

  waitIdle(sessionId: string) {
    // A turn can run for minutes; wait without a client timeout.
    return new Promise<void>((resolve, reject) => {
      const req = http.request(`${this.local}/api/experimental/session/${sessionId}/wait`, {
        method: "POST",
        headers: { authorization: "Basic " + Buffer.from(`opencode:${this.password}`).toString("base64"), "content-type": "application/json" },
      }, (res) => {
        res.resume();
        res.on("end", () => (res.statusCode && res.statusCode < 300 ? resolve() : reject(new Error(`opencode wait: ${res.statusCode}`))));
      });
      req.on("error", reject);
      req.setTimeout(0);
      req.end();
    });
  }

  async nudge(sessionId: string, text: string) {
    await this.api("POST", `/api/session/${sessionId}/synthetic`, { text });
    await this.waitIdle(sessionId);
  }

  async forwardPrompt(sessionId: string, query: string, body: string) {
    const res = await fetch(`${this.local}/api/session/${sessionId}/prompt${query}`, {
      method: "POST",
      headers: { authorization: "Basic " + Buffer.from(`opencode:${this.password}`).toString("base64"), "content-type": "application/json" },
      body,
    });
    return { status: res.status, body: await res.text() };
  }

  proxy() {
    return { url: this.local, authorization: "Basic " + Buffer.from(`opencode:${this.password}`).toString("base64") };
  }

  close() {
    this.abort.abort();
    this.proc?.kill("SIGTERM");
  }
}

// Stand-in for opencode and the model (AGENT=fake): plays the Drehbuch from the reference files, no agent UI.
export class FakeAgentHost implements AgentHost {
  readonly checkpoints = { handler: null as CheckpointHandler | null, setHandler: (h: CheckpointHandler) => void (this.checkpoints.handler = h) };
  readonly prompts: { sessionId: string; text: string; agent?: string }[] = [];
  // test hook: ends the turn once after this step's checkpoint, like a model stopping between steps
  stopAfterStep?: number;
  private sessions = new Map<string, { dir: string; turns: number; next: number; redo?: number; running?: Promise<void> }>();
  private n = 0;

  constructor(private readonly steps: (dir: string) => Map<string, string>[]) {}

  async startSession({ dir }: { dir: string; title: string; agent: string }) {
    const id = `fake_${++this.n}`;
    this.sessions.set(id, { dir, turns: 0, next: 1 });
    return { id };
  }

  async runTurn(sessionId: string, text: string, agent?: string) {
    this.prompts.push({ sessionId, text, agent });
    const s = this.sessions.get(sessionId)!;
    // The first turn is the plan; the second (the approval) builds. A later one (a rejection when done) only asks.
    if (++s.turns === 2) await this.build(sessionId);
  }

  private async build(sessionId: string) {
    const s = this.sessions.get(sessionId)!;
    const steps = this.steps(s.dir);
    for (; s.next <= 4; ) {
      const n = s.next++;
      for (const [rel, content] of steps[n - 1]!) {
        fs.mkdirSync(path.dirname(path.join(s.dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(s.dir, rel), content);
      }
      if (n < 4 && (await this.checkpoint(n)).includes("rejected")) {
        s.redo = n;
        return;
      }
      if (n === this.stopAfterStep) {
        this.stopAfterStep = undefined;
        return;
      }
    }
  }

  private async checkpoint(step: number) {
    return (await this.checkpoints.handler?.(step)) ?? CONTINUE;
  }

  async waitIdle(sessionId: string) {
    await this.sessions.get(sessionId)!.running;
  }

  async forwardPrompt(sessionId: string, _query: string, body: string) {
    this.prompts.push({ sessionId, text: String((JSON.parse(body) as { text?: unknown }).text ?? "") });
    const s = this.sessions.get(sessionId)!;
    const text = String((JSON.parse(body) as { text?: unknown }).text ?? "");
    s.running = text.trim().length <= 3 ? Promise.resolve() : this.goOn(sessionId);
    return { status: 200, body: "{}" };
  }

  async nudge(sessionId: string, text: string) {
    this.prompts.push({ sessionId, text });
    await this.goOn(sessionId);
  }

  private async goOn(sessionId: string) {
    const s = this.sessions.get(sessionId)!;
    if (s.redo !== undefined) await this.checkpoint(s.redo);
    s.redo = undefined;
    await this.build(sessionId);
  }

  proxy() {
    return undefined;
  }

  close() {}
}
