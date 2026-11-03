import { ValidationError } from "../errors.ts";
import type { GreetingUser } from "./types.ts";

/** Turns a user into a greeting, for example "Hello, Ada!". */
export function formatGreeting(user: GreetingUser): string {
  const fullName = user.name?.trim();
  if (!fullName) {
    throw new ValidationError("name must be a non-empty string");
  }

  if (user.tone === "formal") {
    return `Good day, ${fullName}.`;
  }

  const preferred = user.preferredName?.trim();
  const name = preferred || fullName.split(/\s+/)[0]!;
  return `Hello, ${name}!`;
}
