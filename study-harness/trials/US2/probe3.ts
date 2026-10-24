import { createAccountStore, getAccount } from "./src/lib/accounts.ts";
import { fakeClock } from "./src/lib/clock.ts";
import { createEventLog } from "./src/lib/db.ts";
import { processEventOnce } from "./src/lib/webhooks/idempotency.ts";

const deps = { accounts: createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]), log: createEventLog(fakeClock()), clock: fakeClock() };
const event = { id: "e1", type: "payment.succeeded" as const, accountId: "a", amount: "10.00" };
await processEventOnce(deps, event);
await processEventOnce(deps, event);
const times = getAccount(deps.accounts, "a").balanceCents / 1000;
console.log(times === 1 ? "Once" : times === 2 ? "Twice" : times === 0 ? "Never" : String(times));
