import { QuotaExceededError } from "./src/lib/errors.ts";
import { withQuota } from "./src/lib/tenants/quota.ts";

const tenant = { id: "t", name: "T", overrides: { limits: { maxUsers: 5 } } };
try {
  const result = await withQuota(tenant, "maxUsers", 0, () => "added", 6);
  console.log(result === "added" ? "The operation runs" : "?");
} catch (err) {
  console.log(err instanceof QuotaExceededError && err.status === 429 ? "It fails with a 429 QuotaExceededError" : (err as { status?: number }).status === 400 ? "It fails with 400" : "?");
}
