import { AppError } from "./errors.ts";

/** Plain-text response, for endpoints that answer with a short word. */
export function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** JSON response with the given status. */
export function json(status: number, value: unknown): Response {
  return Response.json(value, { status });
}

/** Maps an AppError to its status; anything else is a bug and is rethrown. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return json(err.status, { ok: false, error: err.message });
  }
  throw err;
}
