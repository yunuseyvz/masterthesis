import { formatGreeting } from "./greeting.ts";

export function greetAll(names: string[], formal = false): string[] {
  return names.map((name) => formatGreeting({ name, formal }));
}
