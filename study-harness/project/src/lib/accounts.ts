import { NotFoundError } from "./errors.ts";
import { assertCents, type Cents } from "./money.ts";

export interface Account {
  id: string;
  name: string;
  balanceCents: Cents;
}

export interface AccountStore {
  accounts: Map<string, Account>;
}

export function createAccountStore(seed: Account[] = []): AccountStore {
  return { accounts: new Map(seed.map((a) => [a.id, { ...a }])) };
}

export function getAccount(store: AccountStore, id: string): Account {
  const account = store.accounts.get(id);
  if (!account) {
    throw new NotFoundError(`account ${id}`);
  }
  return account;
}

/** Adds `deltaCents` (which may be negative) to an account's balance and returns the account. */
export function adjustBalance(store: AccountStore, id: string, deltaCents: Cents): Account {
  const account = getAccount(store, id);
  account.balanceCents += assertCents(deltaCents);
  return account;
}
