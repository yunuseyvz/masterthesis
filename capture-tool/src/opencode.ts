import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

/** A free loopback port. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

/** Environment that keeps opencode's config, data and state inside `home` (nothing from the user's own setup). */
export function opencodeEnv(home: string, password: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_DATA_HOME: path.join(home, ".local", "share"),
    XDG_STATE_HOME: path.join(home, ".local", "state"),
    XDG_CACHE_HOME: path.join(home, ".cache"),
    OPENCODE_PASSWORD: password,
  };
}

/**
 * opencode's global config: one OpenAI-compatible provider whose base URL is the recording proxy. Unless allowed,
 * the agent may not ask the person multiple-choice questions (opencode's `question` tool): a replay would put the
 * same question in front of a participant and wait for an answer the study never gives. `brief` becomes opencode's
 * global AGENTS.md.
 */
export function writeConfig(home: string, proxyUrl: string, model: string, allowQuestions = false, brief?: string) {
  const deny = allowQuestions ? [] : [{ action: "question", resource: "*", effect: "deny" }];
  const dir = path.join(home, ".config", "opencode");
  fs.mkdirSync(dir, { recursive: true });
  // Global instructions: opencode adds them to every request's system prompt, the person never sees them.
  if (brief) fs.writeFileSync(path.join(dir, "AGENTS.md"), brief);
  fs.writeFileSync(
    path.join(dir, "opencode.jsonc"),
    JSON.stringify(
      {
        providers: {
          capture: { name: "Captured model", package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: proxyUrl, apiKey: "capture" }, models: { [model]: { name: model } } },
        },
        model: `capture-tool/${model}`,
        permissions: deny,
        // Agents add their own rules (Plan mode allows questions); the last matching rule wins, so deny again per agent.
        agents: allowQuestions ? {} : { plan: { permissions: deny }, build: { permissions: deny } },
      },
      null,
      2,
    ),
  );
}

/** `opencode serve` on loopback, with its API. */
export class OpencodeServer {
  readonly password = randomBytes(18).toString("base64url");
  url = "";
  private proc: ChildProcess | null = null;

  constructor(
    private readonly bin: string,
    readonly home: string,
  ) {}

  async start(cwd: string) {
    const port = await freePort();
    this.url = `http://127.0.0.1:${port}`;
    this.proc = spawn(this.bin, ["serve", "--port", String(port), "--hostname", "127.0.0.1"], { cwd, env: opencodeEnv(this.home, this.password), stdio: ["ignore", "pipe", "pipe"] });
    await new Promise<void>((resolve, reject) => {
      let out = "";
      const timer = setTimeout(() => reject(new Error(`opencode did not start: ${out.slice(-500)}`)), 30_000);
      const onData = (d: Buffer) => {
        out += d.toString();
        if (/listening/.test(out)) {
          clearTimeout(timer);
          resolve();
        }
      };
      this.proc!.stdout!.on("data", onData);
      this.proc!.stderr!.on("data", onData);
      this.proc!.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`opencode exited (${code}): ${out.slice(-500)}`));
      });
    });
    return this;
  }

  async api<T = unknown>(method: string, p: string, body?: unknown): Promise<T> {
    const res = await fetch(this.url + p, {
      method,
      headers: { authorization: "Basic " + Buffer.from(`opencode:${this.password}`).toString("base64"), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`opencode ${method} ${p}: ${res.status} ${await res.text()}`);
    return (res.status === 204 ? null : await res.json()) as T;
  }

  /** Resolves when the session's turn is over. A real turn can take many minutes, so no client timeout applies. */
  waitIdle(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = http.request(`${this.url}/api/experimental/session/${sessionId}/wait`, {
        method: "POST",
        headers: { authorization: "Basic " + Buffer.from(`opencode:${this.password}`).toString("base64"), "content-type": "application/json" },
      }, (res) => {
        res.resume();
        res.on("end", () => (res.statusCode && res.statusCode < 300 ? resolve() : reject(new Error(`wait: ${res.statusCode}`))));
      });
      req.on("error", reject);
      req.setTimeout(0);
      req.end();
    });
  }

  /** opencode's own terminal UI, attached to this server, in the foreground until the person quits it. */
  tui(dir: string): Promise<number | null> {
    return new Promise((resolve) => {
      const p = spawn(this.bin, ["--server", this.url, dir], { cwd: dir, env: opencodeEnv(this.home, this.password), stdio: "inherit" });
      p.on("exit", (code) => resolve(code));
    });
  }

  stop() {
    this.proc?.kill("SIGTERM");
  }
}
