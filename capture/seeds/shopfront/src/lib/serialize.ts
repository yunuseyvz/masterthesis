import type { Account } from "./accounts.ts";
import { formatCents } from "./money.ts";
import type { Order } from "./orders.ts";

export function accountView(account: Account): { id: string; name: string; balance: string } {
  return { id: account.id, name: account.name, balance: formatCents(account.balanceCents) };
}

export function orderView(order: Order): { id: string; accountId: string; itemCount: number } {
  return { id: order.id, accountId: order.accountId, itemCount: order.lines.reduce((n, l) => n + l.quantity, 0) };
}
