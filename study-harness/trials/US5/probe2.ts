import { clientId } from "./src/lib/ratelimit/respond.ts";

console.log(clientId(new Request("http://localhost", { headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2", "x-real-ip": "10.0.0.9" } })));
