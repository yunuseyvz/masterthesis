import type { Catalog } from "../catalog.ts";
import { formatCents } from "../money.ts";
import { orderSubtotal, type Order } from "../orders.ts";
import { applyDiscount } from "./pricing.ts";
import type { Coupon, OrderSummary } from "./types.ts";

export function summarizeOrder(catalog: Catalog, order: Order, coupon?: Coupon): OrderSummary {
  const subtotalCents = orderSubtotal(catalog, order);
  const totalCents = coupon ? applyDiscount(subtotalCents, coupon.percent) : subtotalCents;
  return { subtotalCents, discountCents: subtotalCents - totalCents, totalCents };
}

export function formatSummary(summary: OrderSummary): string {
  return [
    `Subtotal: ${formatCents(summary.subtotalCents)}`,
    `Discount: -${formatCents(summary.discountCents)}`,
    `Total:    ${formatCents(summary.totalCents)}`,
  ].join("\n");
}
