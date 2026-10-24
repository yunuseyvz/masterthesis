import { createAccountStore, type AccountStore } from "./accounts.ts";
import { createCatalog, type Catalog } from "./catalog.ts";

export interface Db {
  accounts: AccountStore;
  catalog: Catalog;
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
      { sku: "mug", name: "Enamel mug", priceCents: 1200 },
      { sku: "pen", name: "Fountain pen", priceCents: 3400 },
      { sku: "notebook", name: "Dot-grid notebook", priceCents: 1800 },
    ]),
  };
  return instance;
}

/** Test helper: forget the shared instance. */
export function resetDb(): void {
  instance = undefined;
}
