import { formatGreeting } from "./greeting.ts";
import type { GreetingUser } from "./types.ts";

/** Greets several users at once, in the order they are given. */
export function greetAll(users: GreetingUser[]): string[] {
  return users.map((user) => formatGreeting(user));
}
