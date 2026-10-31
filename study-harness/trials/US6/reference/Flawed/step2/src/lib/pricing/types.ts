import type { Cents } from "../money.ts";

export type CouponKind = "percentage" | "fixed";

export interface Coupon {
  /** The code the shopper enters, for display and audit. */
  code: string;
  kind: CouponKind;
  /** Percentage points for "percentage", integer cents for "fixed". */
  value: number;
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
}

export interface OrderSummary {
  items: OrderItem[];
  subtotalCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
  coupon?: Coupon;
}
