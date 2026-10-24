// Host-side bridge: the container has no network (--network none), so it serves on a unix socket.
// Usage: node scripts/forward.mjs <socket-path> <port>
import net from "node:net";

const [sock, port] = process.argv.slice(2);
if (!sock || !port) throw new Error("usage: forward.mjs <socket-path> <port>");

net
  .createServer((c) => {
    const u = net.connect(sock);
    c.pipe(u);
    u.pipe(c);
    c.on("error", () => u.destroy());
    u.on("error", () => c.destroy());
  })
  .listen(Number(port), "127.0.0.1", () => console.log(`http://localhost:${port} -> ${sock}`));
