/** Keeps a discount percentage within 0-100. */
export function clampPercent(pct: number): number {
  return Math.min(100, Math.max(0, pct));
}

/** Price after a percentage discount, in whole cents. */
export function applyDiscount(amountCents: number, pct: number): number {
  const factor = 1 - clampPercent(pct) / 100;
  return Math.round(amountCents * factor);
}
