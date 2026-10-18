import { getEffectiveConfig } from "./src/config.ts";
import { ORG_DEFAULTS } from "./src/types.ts";

const cfg = getEffectiveConfig({ ...ORG_DEFAULTS, allowExport: true }, { allowExport: false });
console.log(String(cfg.allowExport));
