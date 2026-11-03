import { createAccountStore, getAccount } from "./src/lib/accounts.ts";
import { applyPayment } from "./src/lib/webhooks/handlers.ts";

const accounts = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]);
applyPayment({ accounts }, { id: "e", type: "payment.succeeded", accountId: "a", amount: "19.99" });
console.log(String(getAccount(accounts, "a").balanceCents));
