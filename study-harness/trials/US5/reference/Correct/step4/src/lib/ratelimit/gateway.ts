import { systemClock } from "../clock.ts";
import { createLimiter, type RateLimiter } from "./limiter.ts";
import { clientId, rejection } from "./respond.ts";

export type RequestHandler = (request: Request) => Response | Promise<Response>;

const defaultLimiter = createLimiter(systemClock);

/** Wraps a handler so each client gets at most a limited number of requests per window. */
export function rateLimited(handler: RequestHandler, limiter: RateLimiter = defaultLimiter): RequestHandler {
  return async (request) => {
    const decision = limiter.check(clientId(request));
    if (!decision.allowed) {
      return rejection(decision.retryAfterMs);
    }
    return handler(request);
  };
}
