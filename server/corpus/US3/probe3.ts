import { checkQuota } from "./src/lib/tenants/quota.ts";
import { createQuotaState } from "./src/lib/tenants/types.ts";

const state = createQuotaState();
const allowed = [1, 2, 3].filter(() => checkQuota("t1", { rateLimit: 2 }, state).allowed).length;
console.log(String(allowed));
