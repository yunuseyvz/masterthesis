// Prints the true option text of every understanding item, in trial.json order.
import { STATUS_CODES } from "node:http";

// Any other status in the options' form ("404: not found"); "?" (not graded) when it has no name.
const statusText = (status: number) => (STATUS_CODES[status] ? `${status}: ${STATUS_CODES[status]!.toLowerCase()}` : `? it answers ${status}`);

// A module of the agent's code, or an empty one if it is missing: then only the items that use it fail.
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { AppError, NotFoundError, OutOfStockError } = await optional(import("./src/lib/errors.ts"));
const { checkout } = await optional(import("./src/lib/inventory/checkout.ts"));
const { reserveStock, stockOf } = await optional(import("./src/lib/inventory/inventory.ts"));
const { createStockStore } = await optional(import("./src/lib/inventory/types.ts"));

const items: (() => Promise<string> | string)[] = [
  // open case (step 2): more ordered than is left
  () => {
    const store = createStockStore([{ productId: "mug", stock: 3 }]);
    try {
      const left = reserveStock(store, "mug", 5);
      return left < 0 ? "5 mugs are reserved; the stock goes to -2" : "3 mugs are reserved without a note; the stock goes to 0";
    } catch (err) {
      if (!(err instanceof OutOfStockError)) return "? it throws";
      return stockOf(store, "mug") === 3 ? "Rejected as out of stock; the stock stays at 3" : "3 mugs are reserved, with a note that it is fewer; the stock goes to 0";
    }
  },
  // flaw (step 2): ordering an item that has just sold out
  () => {
    const store = createStockStore([{ productId: "mug", stock: 2 }]);
    reserveStock(store, "mug", 2);
    try {
      reserveStock(store, "mug", 1);
      return "The mug is reserved anyway";
    } catch (err) {
      return err instanceof OutOfStockError ? "Told the mug is out of stock (409)" : err instanceof NotFoundError ? "Told the mug does not exist (404)" : "Told there was a server error (500)";
    }
  },
  // dependency (step 3): checkout reports the quantity ordered
  () => {
    const r = checkout(createStockStore([{ productId: "mug", stock: 3 }]), JSON.stringify({ productId: "mug", quantity: 2 }));
    return r.quantity === 2 && r.remaining === 1 ? "The quantity ordered" : "?";
  },
  // emergent (step 3): an unknown field in the request
  () => {
    try {
      const r = checkout(createStockStore([{ productId: "mug", stock: 3 }]), JSON.stringify({ productId: "mug", quantity: 1, gift: true }));
      return "gift" in r ? "The mug is reserved and the gift flag is kept" : "The field is ignored and the mug is reserved";
    } catch (err) {
      // Any error that is not an AppError becomes a 500 in the route.
      if (err instanceof AppError) return err.status === 400 ? "It is rejected as an invalid request (400)" : `? it answers ${err.status}`;
      return "It fails with a server error (500)";
    }
  },
  // interplay (step 4): the route on an invalid quantity
  async () => {
    const { POST } = await import("./src/app/api/checkout/route.ts");
    const res: Response = await POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: "mug", quantity: 0 }) }));
    return { 400: "400: invalid request", 200: "200: nothing is reserved", 409: "409: out of stock", 500: "500: server error" }[res.status] ?? statusText(res.status);
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
