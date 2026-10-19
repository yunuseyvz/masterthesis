import { errorResponse } from "../../../lib/http.ts";
import { handleCheckout, parseCheckout } from "../../../lib/inventory/checkout.ts";
import { createStore } from "../../../lib/inventory/types.ts";

// Flash-sale stock lives in memory for this process.
const store = createStore({ mug: 20, pen: 5, notebook: 12 });

export async function POST(request: Request) {
  try {
    return handleCheckout(store, parseCheckout(await request.text()));
  } catch (err) {
    return errorResponse(err);
  }
}
