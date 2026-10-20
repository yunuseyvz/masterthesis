import { getEffectiveConfig } from "./src/lib/tenants/config.ts";
import { ORG_DEFAULTS } from "./src/lib/tenants/types.ts";

const cfg = getEffectiveConfig({ ...ORG_DEFAULTS, allowExport: true }, { allowExport: false });
console.log(String(cfg.allowExport));
