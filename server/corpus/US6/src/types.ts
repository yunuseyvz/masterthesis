export interface CartLine {
  sku: string;
  unitPriceCents: number;
  qty: number;
}

export interface Coupon {
  code: string;
  percent: number;
}

export interface OrderSummary {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

export function lineTotal(line: CartLine): number {
  return line.unitPriceCents * line.qty;
}
