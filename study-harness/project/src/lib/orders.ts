import { priceOf, type Catalog } from "./catalog.ts";
import { ValidationError } from "./errors.ts";
import { sumCents, type Cents } from "./money.ts";

export interface OrderLine {
  sku: string;
  quantity: number;
}

export interface Order {
  id: string;
  accountId: string;
  lines: OrderLine[];
}

export function createOrder(id: string, accountId: string, lines: OrderLine[]): Order {
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new ValidationError(`invalid quantity for ${line.sku}`);
    }
  }
  return { id, accountId, lines: lines.map((l) => ({ ...l })) };
}

export function orderSubtotal(catalog: Catalog, order: Order): Cents {
  return sumCents(order.lines.map((l) => priceOf(catalog, l.sku) * l.quantity));
}
