import { isFeatureEnabled } from "./src/lib/sellers/config.ts";

const v = isFeatureEnabled({ id: "t", name: "T", overrides: { features: { refunds: false } } }, "analytics");
console.log(v === false ? "No" : v === true ? "Yes" : "It is undefined");
