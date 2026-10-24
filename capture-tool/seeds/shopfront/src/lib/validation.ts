import { ValidationError } from "./errors.ts";

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value;
}

export function requireInt(value: unknown, field: string, min = Number.MIN_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new ValidationError(`${field} must be an integer of at least ${min}`);
  }
  return value;
}

export function requireOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Parses a request body as a JSON object. */
export function parseJsonObject(body: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new ValidationError("body is not valid JSON");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ValidationError("body must be a JSON object");
  }
  return data as Record<string, unknown>;
}
