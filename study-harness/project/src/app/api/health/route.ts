import { json } from "../../../lib/http.ts";

export async function GET() {
  return json(200, { ok: true });
}
