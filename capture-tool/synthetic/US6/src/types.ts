export interface Coupon {
  code: string;
  percent: number;
}

export interface OrderSummary {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}
