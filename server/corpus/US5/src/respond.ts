import { json, text } from "../http.ts";
import type { FilterResult } from "./types.ts";

/** Identifies the caller: the `x-client-id` header, or one shared id for anonymous callers. */
export function clientIdOf(req: Request): string {
  return req.headers.get("x-client-id") ?? "anonymous";
}

export function toResponse(result: FilterResult): Response {
  if (result.status === 200) {
    return text(200, "ok");
  }
  return json(429, { error: "rate limit exceeded", retryAfterMs: result.retryAfterMs });
}
