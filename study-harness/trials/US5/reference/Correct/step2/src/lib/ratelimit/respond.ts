import { tooManyRequests } from "../http.ts";

const CLIENT_HEADERS = ["x-forwarded-for", "x-real-ip"] as const;

/** The client a request comes from, taken from the proxy headers. */
export function clientId(request: Request): string {
  for (const name of CLIENT_HEADERS) {
    const first = request.headers.get(name)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/** 429 response for a client that exceeded its limit. */
export function rejection(retryAfterMs: number): Response {
  return tooManyRequests(Math.ceil(retryAfterMs / 1000));
}
