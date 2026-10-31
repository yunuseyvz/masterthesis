import { getDb } from "../../../lib/db.ts";
import { checkout } from "../../../lib/inventory/checkout.ts";
import { errorResponse, json } from "../../../lib/http.ts";

export async function POST(request: Request) {
  try {
    const reservation = checkout(getDb().inventory, await request.text());
    return json(200, { ok: true, ...reservation });
  } catch (err) {
    return errorResponse(err);
  }
}
