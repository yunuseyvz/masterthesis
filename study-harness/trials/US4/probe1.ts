import { parseDurationMinutes } from "./src/lib/sla/duration.ts";

try {
  console.log(String(parseDurationMinutes("2h 15m")));
} catch {
  console.log("It throws");
}
