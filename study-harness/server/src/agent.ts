import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { ReplayEndpoint } from "./replay.js";
import { chownTree, type SandboxOptions } from "./sandbox.js";

/** The coding agent the participant watches. The study server starts every turn and waits for it to finish. */
export interface AgentHost {
  /** Opens an agent session for a trial whose project lives in `dir`, with the agent the captured session started with. */
  startSession(opts: { dir: string; title: string; agent: string }): Promise<{ id: string }>;
  /** Sends a user message (with the agent it ran with in the capture) and resolves once the agent's turn is over. */
  runTurn(sessionId: string, text: string, agent?: string): Promise<void>;
  /** Where the study server forwards the agent's API (/api, /auth), with the credentials to add; undefined: no agent UI. */
  proxy(): { url: string; authorization: string } | undefined;
  close(): void;
}

export interface OpencodeOptions {
  /** opencode binary (v2, @opencode/cli). */
  bin: string;
  /** Port opencode listens on (loopback only; the study server forwards to it). */
  port: number;
  /** Where the replay endpoint listens, as seen from opencode. */
  replayUrl: string;
  /** Home directory for opencode's config, data and state (owned by the sandbox uid). */
  home: string;
  sandbox: SandboxOptions;
  log: (type: string, data: unknown) => void;
}

/** Event types that are only streaming noise; everything else from opencode goes into the study's event log. */
const NOISY = /delta|\.part\.|heartbeat|stream/i;

/**
 * Real opencode v2 (`opencode serve`) whose model is the replay endpoint. It runs as the sandbox uid, so its
 * tools and the participant's terminal cannot read the trials, the captures or the exports.
 */
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
    // Global config, so that no opencode file shows up in the participant's project.
    fs.writeFileSync(
      path.join(config, "opencode.jsonc"),
      JSON.stringify(
        {
          providers: { replay: { name: "Study agent", package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: this.o.replayUrl, apiKey: "replay" }, models: { replay: { name: "Study agent" } } } },
          model: "replay/replay",
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

  /** Copies opencode's own event stream into the study log (participant activity inside the agent UI). */
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
    const r = (await this.api("POST", "/api/session", { title, agent, model: { id: "replay", providerID: "replay" }, location: { directory: dir } })) as { data: { id: string } };
    return { id: r.data.id };
  }

  async runTurn(sessionId: string, text: string, agent?: string) {
    if (agent) await this.api("POST", `/api/session/${sessionId}/agent`, { agent });
    await this.api("POST", `/api/session/${sessionId}/prompt`, { text });
    // A turn can run for minutes (a long capture); wait without a client timeout.
    await new Promise<void>((resolve, reject) => {
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

  proxy() {
    return { url: this.local, authorization: "Basic " + Buffer.from(`opencode:${this.password}`).toString("base64") };
  }

  close() {
    this.abort.abort();
    this.proc?.kill("SIGTERM");
  }
}

/**
 * Stand-in for tests and UI development without opencode: plays the replay synchronously, as opencode would ask for
 * it, and puts the project into the state each response leaves it in (from the capture's snapshots). No web UI.
 */
export class FakeAgentHost implements AgentHost {
  private sessions = new Map<string, { dir: string; messages: { role: string; content: string; tool_calls?: unknown[] }[] }>();
  readonly prompts: { sessionId: string; text: string; agent?: string }[] = [];
  private n = 0;

  constructor(private readonly replay: ReplayEndpoint) {}

  async startSession({ dir }: { dir: string; title: string; agent: string }) {
    const id = `fake_${++this.n}`;
    this.sessions.set(id, { dir, messages: [] });
    return { id };
  }

  async runTurn(sessionId: string, text: string, agent?: string) {
    this.prompts.push({ sessionId, text, agent });
    const s = this.sessions.get(sessionId)!;
    s.messages.push({ role: "user", content: text });
    for (let guard = 0; guard < 500; guard++) {
      const reply = this.replay.next({ messages: s.messages, tools: [{}], stream: true });
      if (reply.kind === "text") {
        s.messages.push({ role: "assistant", content: reply.text });
        return;
      }
      if (!reply.main) continue;
      const files = this.replay.filesAfter(reply.call.position);
      for (const [rel, content] of files ?? []) {
        const abs = path.join(s.dir, rel);
        if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === content) continue;
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
      }
      s.messages.push({ role: "assistant", content: "response", tool_calls: reply.endsTurn ? undefined : [{}] });
      if (reply.endsTurn) return;
    }
  }

  proxy() {
    return undefined;
  }

  close() {}
}
