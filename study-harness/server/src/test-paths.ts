import path from "node:path";
import { fileURLToPath } from "node:url";

/** The repository's trials and captures, for tests. */
const here = path.dirname(fileURLToPath(import.meta.url));
export const trialsDir = path.resolve(here, "../../trials");
export const capturesDir = path.resolve(here, "../../../captures");
