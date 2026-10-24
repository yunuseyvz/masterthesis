import http from "node:http";
import { assistantCount } from "@beacon/shared";

/** A scripted OpenAI-compatible model: writes hello.txt, then says it is done. Titles get a fixed answer. Keeps the raw requests. */
export function fakeModel(): Promise<{ url: string; close: () => void; requests: string[] }> {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      requests.push(raw);
      const body = JSON.parse(raw || "{}") as { stream?: boolean; tools?: unknown[]; messages?: { role: string }[] };
      const ev = (delta: object, finish: string | null = null) => `data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: "fake", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      const turn = assistantCount(body);
      const text = !body.tools?.length ? "Hello file" : turn === 0 ? "I'll create the file." : "Done.";
      const tool = body.tools?.length && turn === 0 ? { index: 0, id: "call_1", type: "function", function: { name: "write", arguments: JSON.stringify({ path: "hello.txt", content: "hi\n" }) } } : null;
      if (!body.stream) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "fake", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: text } }] }));
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(ev({ role: "assistant", content: "" }));
      setTimeout(() => {
        res.write(ev({ content: text }));
        if (tool) res.write(ev({ tool_calls: [tool] }));
        res.write(ev({}, tool ? "tool_calls" : "stop"));
        res.end("data: [DONE]\n\n");
      }, 150);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, close: () => server.close(), requests })));
}
