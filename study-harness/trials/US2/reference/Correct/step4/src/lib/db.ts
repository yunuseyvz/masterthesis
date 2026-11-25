import { createAccountStore, type AccountStore } from "./accounts.ts";
import { createCatalog, type Catalog } from "./catalog.ts";
import { systemClock, type Clock } from "./clock.ts";
import type { EventLog, EventLogEntry, ProcessedStatus } from "./payments/types.ts";

export interface Db {
  accounts: AccountStore;
  catalog: Catalog;
  paymentEvents: EventLog;
}

/** In-memory log of payment events, keyed by the provider's event id. */
export function createEventLog(clock: Clock): EventLog {
  const entries = new Map<string, EventLogEntry>();

  function touch(eventId: string, status: ProcessedStatus): EventLogEntry {
    const previous = entries.get(eventId);
    const entry: EventLogEntry = {
      eventId,
      status,
      attempts: status === "processing" ? (previous?.attempts ?? 0) + 1 : (previous?.attempts ?? 0),
      at: clock.now(),
    };
    entries.set(eventId, entry);
    return entry;
  }

  return {
    entries,
    get: (eventId) => entries.get(eventId),
    start: (eventId) => touch(eventId, "processing"),
    succeed: (eventId) => touch(eventId, "processed"),
    fail: (eventId) => touch(eventId, "failed"),
  };
}

let instance: Db | undefined;

/** The in-memory "database" shared by all route handlers of this process. */
export function getDb(): Db {
  instance ??= {
    accounts: createAccountStore([
      { id: "acc_1", name: "Ada Lovelace", balanceCents: 0 },
      { id: "acc_2", name: "Grace Hopper", balanceCents: 2500 },
    ]),
    catalog: createCatalog([
      { productId: "mug", name: "Enamel mug", priceCents: 1200 },
      { productId: "pen", name: "Fountain pen", priceCents: 3400 },
      { productId: "notebook", name: "Dot-grid notebook", priceCents: 1800 },
    ]),
    paymentEvents: createEventLog(systemClock),
  };
  return instance;
}

/** Test helper: forget the shared instance. */
export function resetDb(): void {
  instance = undefined;
}
