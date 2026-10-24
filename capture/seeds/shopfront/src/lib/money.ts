/** Amounts are integer cents everywhere in this codebase. */
export type Cents = number;

export function assertCents(n: number): Cents {
  if (!Number.isInteger(n)) {
    throw new RangeError(`not an integer number of cents: ${n}`);
  }
  return n;
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, v) => total + assertCents(v), 0);
}

export function formatCents(n: Cents): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(assertCents(n));
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
