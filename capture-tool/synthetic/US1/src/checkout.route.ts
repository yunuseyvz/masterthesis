import { getDb } from "../../../lib/db.ts";
import { errorResponse } from "../../../lib/http.ts";
import { handleCheckout, parseCheckout } from "../../../lib/inventory/checkout.ts";

export async function POST(request: Request) {
  try {
    return handleCheckout(getDb().inventory, parseCheckout(await request.text()));
  } catch (err) {
    return errorResponse(err);
  }
}
