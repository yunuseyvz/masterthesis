import { createStore } from "./src/lib/inventory/types.ts";
import { handleCheckout, parseCheckout } from "./src/lib/inventory/checkout.ts";

const store = createStore({ mug: 20 });
console.log(String(handleCheckout(store, parseCheckout('{"skuId": "mug"}')).status));
