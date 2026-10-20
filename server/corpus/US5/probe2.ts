import { clientIdOf } from "./src/lib/ratelimit/respond.ts";

console.log(clientIdOf(new Request("http://localhost/api")));
