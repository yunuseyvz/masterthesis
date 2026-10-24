import type { GreetingOptions } from "./types.ts";

export function formatGreeting(opts: GreetingOptions): string {
  const name = opts.name.trim();
  if (name === "") {
    return "Hi there!";
  }
  return opts.formal ? `Dear ${name},` : `Hi ${name}!`;
}
