// Runs the story's code and prints the true option text for every understanding item, in the order of trial.json.
// The harness test compares this output with the item's `correct` index for both variants.

/** A module of the agent's code, or an empty one if it is missing: then only the items that use it fail. */
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { AppError, NotFoundError, OutOfStockError } = await optional(import("./src/lib/errors.ts"));
const { checkout } = await optional(import("./src/lib/inventory/checkout.ts"));
const { reserveStock, stockOf } = await optional(import("./src/lib/inventory/inventory.ts"));
const { createStockStore } = await optional(import("./src/lib/inventory/types.ts"));

const items: (() => Promise<string> | string)[] = [
  // open case (step 2): more ordered than is left
  () => {
    const store = createStockStore([{ sku: "mug", stock: 3 }]);
    try {
      const left = reserveStock(store, "mug", 5);
      return left < 0 ? "The order goes through and the stock goes to -2" : "The 3 mugs are reserved without a word";
    } catch (err) {
      if (!(err instanceof OutOfStockError)) return "? it throws";
      return stockOf(store, "mug") === 3 ? "The whole order is rejected as out of stock; 3 mugs stay in stock" : "The 3 mugs are reserved and the customer is told it is fewer";
    }
  },
  // flaw (step 2): ordering an item that has just sold out
  () => {
    const store = createStockStore([{ sku: "mug", stock: 2 }]);
    reserveStock(store, "mug", 2);
    try {
      reserveStock(store, "mug", 1);
      return "The mug is reserved";
    } catch (err) {
      return err instanceof OutOfStockError ? "Told the mug is out of stock (409)" : err instanceof NotFoundError ? "Told the mug does not exist (404)" : "A server error (500)";
    }
  },
  // dependency (step 3): checkout reports the quantity ordered
  () => {
    const r = checkout(createStockStore([{ sku: "mug", stock: 3 }]), JSON.stringify({ sku: "mug", quantity: 2 }));
    return r.quantity === 2 && r.remaining === 1 ? "Always the quantity ordered, since a reservation is all or nothing" : "?";
  },
  // emergent (step 3): an unknown field in the request
  () => {
    try {
      const r = checkout(createStockStore([{ sku: "mug", stock: 3 }]), JSON.stringify({ sku: "mug", quantity: 1, gift: true }));
      return "gift" in r ? "The mug is reserved and the gift flag is kept" : "The field is ignored and the mug is reserved";
    } catch (err) {
      return err instanceof AppError && err.status === 400 ? "It is rejected as an invalid request (400)" : err instanceof OutOfStockError ? "It is rejected as out of stock (409)" : "? it throws";
    }
  },
  // interplay (step 4): the route on an invalid quantity
  async () => {
    const { POST } = await import("./src/app/api/checkout/route.ts");
    const res: Response = await POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sku: "mug", quantity: 0 }) }));
    return { 400: "400: invalid request", 200: "200: nothing is reserved", 409: "409: out of stock", 500: "500: server error" }[res.status] ?? `It answers ${res.status}`;
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
