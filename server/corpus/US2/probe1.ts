import { createEventLog } from "./src/lib/webhooks/types.ts";

const first = createEventLog();
const second = createEventLog();
first.processed.add("evt_1");
console.log(second.processed.has("evt_1") ? "Yes, they share one set" : "No, each log is separate");
