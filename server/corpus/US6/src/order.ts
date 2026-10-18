import { applyDiscount } from "./pricing.ts";
import { lineTotal, type CartLine, type Coupon, type OrderSummary } from "./types.ts";

export function summarizeOrder(lines: CartLine[], coupon?: Coupon): OrderSummary {
  const subtotalCents = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const totalCents = coupon ? applyDiscount(subtotalCents, coupon.percent) : subtotalCents;
  return { subtotalCents, discountCents: subtotalCents - totalCents, totalCents };
}

export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`;
}

export function formatSummary(summary: OrderSummary): string {
  return [
    `Subtotal: ${formatCents(summary.subtotalCents)}`,
    `Discount: -${formatCents(summary.discountCents)}`,
    `Total:    ${formatCents(summary.totalCents)}`,
  ].join("\n");
}
