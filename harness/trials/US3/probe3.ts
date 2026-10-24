import { QuotaExceededError } from "./src/lib/errors.ts";
import { withQuota } from "./src/lib/tenants/quota.ts";

const tenant = { id: "t", name: "T", overrides: { limits: { maxUsers: 5 } } };
try {
  await withQuota(tenant, "maxUsers", 4, () => "added", 3);
  console.log("The operation runs");
} catch (err) {
  console.log(err instanceof QuotaExceededError && err.status === 429 ? "It fails with a 429 QuotaExceededError" : "?");
}
