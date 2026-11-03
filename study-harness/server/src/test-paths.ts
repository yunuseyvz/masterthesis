import path from "node:path";
import { fileURLToPath } from "node:url";

/** The repository's trials and project, for tests. */
const here = path.dirname(fileURLToPath(import.meta.url));
export const trialsDir = path.resolve(here, "../../trials");
export const projectDir = path.resolve(here, "../../project");
