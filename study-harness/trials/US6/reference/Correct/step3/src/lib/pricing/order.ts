import { type Catalog, getProduct } from "../catalog.ts";
import { type Order, orderSubtotal } from "../orders.ts";
import { discountFor } from "./pricing.ts";
import type { Coupon, OrderItem, OrderSummary } from "./types.ts";

/** Totals an order's lines and applies an optional coupon to the subtotal. */
export function summarizeOrder(catalog: Catalog, order: Order, coupon?: Coupon): OrderSummary {
  const items: OrderItem[] = order.lines.map((line) => {
    const product = getProduct(catalog, line.sku);
    return {
      sku: line.sku,
      name: product.name,
      quantity: line.quantity,
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents * line.quantity,
    };
  });

  const subtotalCents = orderSubtotal(catalog, order);
  const discountCents = coupon ? discountFor(subtotalCents, coupon) : 0;

  return {
    items,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    coupon,
  };
}
