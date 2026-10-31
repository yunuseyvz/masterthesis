import { createAccountStore, getAccount } from "./src/lib/accounts.ts";
import { fakeClock } from "./src/lib/clock.ts";
import { processEventOnce } from "./src/lib/webhooks/idempotency.ts";

/** The event log's factory: in src/lib/db.ts as the outline says, or next to the webhook types. */
async function eventLogFactory(): Promise<(clock: unknown) => any> {
  for (const p of ["./src/lib/db.ts", "./src/lib/webhooks/types.ts", "./src/lib/webhooks/event-log.ts", "./src/lib/webhooks/eventLog.ts"]) {
    const m = await import(p).catch(() => ({}));
    if (typeof (m as { createEventLog?: unknown }).createEventLog === "function") return (m as { createEventLog: (c: unknown) => any }).createEventLog;
  }
  return memoryLog;
}
/**
 * At a pause after step 3 the event log's factory (step 4) does not exist yet: an event log with the interface step 1
 * defines (get, start, succeed, fail; status and attempts per event) stands in for it.
 */
function memoryLog() {
  const entries = new Map<string, { eventId: string; status: string; attempts: number; at: number }>();
  const set = (eventId: string, status: string) => {
    const entry = entries.get(eventId) ?? { eventId, status, attempts: 0, at: 0 };
    entry.status = status;
    entries.set(eventId, entry);
    return entry;
  };
  return {
    entries,
    get: (eventId: string) => entries.get(eventId),
    start(eventId: string) {
      const entry = set(eventId, "processing");
      entry.attempts++;
      return entry;
    },
    succeed: (eventId: string) => set(eventId, "processed"),
    fail: (eventId: string) => set(eventId, "failed"),
  };
}
const createEventLog = await eventLogFactory();

const deps = { accounts: createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]), log: createEventLog(fakeClock()), clock: fakeClock() };
const event = { id: "e1", type: "payment.succeeded" as const, accountId: "a", amount: "10.00" };
await processEventOnce(deps, event);
await processEventOnce(deps, event);
const times = getAccount(deps.accounts, "a").balanceCents / 1000;
console.log(times === 1 ? "Once" : times === 2 ? "Twice" : times === 0 ? "Never" : String(times));
