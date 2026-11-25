import { LimitExceededError } from "./src/lib/errors.ts";
import { withinLimit } from "./src/lib/sellers/limits.ts";

const seller = { id: "t", name: "T", overrides: { limits: { maxUsers: 5 } } };
try {
  const result = await withinLimit(seller, "maxUsers", 0, () => "added", 6);
  console.log(result === "added" ? "The operation runs" : "?");
} catch (err) {
  console.log(err instanceof LimitExceededError && err.status === 429 ? "It fails with a 429 LimitExceededError" : (err as { status?: number }).status === 400 ? "It fails with 400" : "?");
}
