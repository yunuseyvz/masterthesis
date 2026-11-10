// Runs the story's code and prints the true option text for every understanding item, in the order of trial.json.
// The harness test compares this output with the item's `correct` index for both variants.

/** A module of the agent's code, or an empty one if it is missing: then only the items that use it fail. */
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { createCatalog } = await optional(import("./src/lib/catalog.ts"));
const { NotFoundError, ValidationError } = await optional(import("./src/lib/errors.ts"));
const { createOrder } = await optional(import("./src/lib/orders.ts"));
const { summarizeOrder } = await optional(import("./src/lib/pricing/order.ts"));
const { discountFor } = await optional(import("./src/lib/pricing/pricing.ts"));

const percent = (value: number) => ({ code: "C", kind: "percentage" as const, value });
const catalog = createCatalog([
  { sku: "mug", name: "Mug", priceCents: 1200 },
  { sku: "a", name: "A", priceCents: 333 },
  { sku: "b", name: "B", priceCents: 333 },
  { sku: "c", name: "C", priceCents: 333 },
]);
/** Describes discountFor's answer, or "rejected" for a ValidationError. */
function discount(amount: number, value: number): string {
  try {
    return String(discountFor(amount, percent(value)));
  } catch (err) {
    return err instanceof ValidationError ? "rejected" : "? it throws";
  }
}

const items: (() => Promise<string> | string)[] = [
  // open case (step 1): a share that is not a whole number of cents
  () => {
    const d = discount(999, 15);
    return d === "rejected" ? "It throws" : d;
  },
  // flaw (step 1): a 100 % coupon on an order
  () => {
    try {
      return String(summarizeOrder(catalog, createOrder("o", "acc", [{ sku: "mug", quantity: 2 }]), percent(100)).totalCents);
    } catch (err) {
      return err instanceof ValidationError ? "It is rejected as an invalid coupon" : "? it throws";
    }
  },
  // emergent (step 1): a fractional percentage
  () => {
    const d = discount(1000, 12.5);
    return d === "rejected" ? "It is rejected as an invalid coupon" : d;
  },
  // dependency (step 3): the order applies the rounded discount once, to the subtotal
  () => String(summarizeOrder(catalog, createOrder("o", "acc", [{ sku: "a", quantity: 1 }, { sku: "b", quantity: 1 }, { sku: "c", quantity: 1 }]), percent(10)).totalCents),
  // interplay (step 3): an item the catalog does not have
  () => {
    try {
      const s = summarizeOrder(catalog, createOrder("o", "acc", [{ sku: "mug", quantity: 1 }, { sku: "nope", quantity: 1 }]));
      return s.items.length === 1 ? "It skips the item" : "It counts the item as 0 cents";
    } catch (err) {
      return err instanceof NotFoundError ? "It throws a NotFoundError (404)" : err instanceof ValidationError ? "It throws a ValidationError (400)" : "? it throws";
    }
  },
];
const out: (string | null)[] = [];
for (const item of items) {
  try {
    out.push(await item());
  } catch {
    out.push(null);
  }
}
console.log(JSON.stringify(out));
