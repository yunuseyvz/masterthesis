import { createAccountStore } from "./src/lib/accounts.ts";
import { fakeClock } from "./src/lib/clock.ts";
import { applyPayment } from "./src/lib/payments/handlers.ts";
import { processEventOnce } from "./src/lib/payments/once.ts";

// The event log's factory: in src/lib/db.ts as the outline says, or next to the payment types.
async function eventLogFactory(): Promise<(clock: unknown) => any> {
  for (const p of ["./src/lib/db.ts", "./src/lib/payments/types.ts", "./src/lib/payments/event-log.ts", "./src/lib/payments/eventLog.ts"]) {
    const m = await import(p).catch(() => ({}));
    if (typeof (m as { createEventLog?: unknown }).createEventLog === "function") return (m as { createEventLog: (c: unknown) => any }).createEventLog;
  }
  return memoryLog;
}
// After step 3 the step-4 event log does not exist yet: this stands in with the interface step 1 defines.
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

// An event for an account that does not exist: crediting it fails with a NotFoundError on every try.
const deps = { accounts: createAccountStore([]), log: createEventLog(fakeClock()), clock: fakeClock() };
const event = { id: "e1", type: "payment.succeeded" as const, accountId: "missing", amount: "10.00" };
let tries = 0;
const handler = (d: typeof deps, e: typeof event) => {
  tries++;
  return applyPayment(d as never, e as never);
};
await processEventOnce(deps as never, event, handler as never, async () => {}).catch(() => {});
// In the options' form; "?" (not graded) past ten.
const times = ["Not once", "Once", "Twice", "Three times", "Four times", "Five times", "Six times", "Seven times", "Eight times", "Nine times", "Ten times"];
console.log(times[tries] ?? `? ${tries} times`);
