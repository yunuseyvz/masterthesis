# User stories and variants

The seven features at a glance. Files: `study-harness/trials/<id>/`; how they are made: [stimuli.md](stimuli.md).
Each measured feature exists in two variants that differ only in the flaw subtask: **Correct** follows the story,
**Flawed** contains one wrong design decision that contradicts one acceptance criterion. The agent's own tests pass in
both.

## Overview

| Story | Feature | Milestone | Flaw | NON_MILESTONE pause | Open case (same in both variants) | Flaw: Correct vs. Flawed |
|---|---|---|---|---|---|---|
| US0 | Greeting formatter (practice) | 2 | – | – | Preferred name of only spaces → first name | – |
| US1 | Flash-sale reservation | 2 | 2 | 1 or 3 | Order 5 when 3 are left → whole order rejected, stock unchanged | Sold out: product stays at 0 → 409 vs. product deleted → 404 |
| US2 | Payment notifications | 3 | 2 | 2 | Repeated delivery of an event that was given up → processed again | Dollars to cents: exact from the digits vs. `Math.floor(amount * 100)` |
| US3 | Seller settings | 2 | 3 | 3 | Limit set to `null` → shop default | Bulk operation counts every item vs. counts as one |
| US4 | Outage refunds | 1 | 3 | 3 | Duration without a unit (`"90"`) → rejected as invalid | Outage crossing the month: the part inside counts vs. skipped |
| US5 | Request limit | 3 | 3 | 2 | Request exactly one window after the oldest → allowed | Rejected requests not counted vs. counted |
| US6 | Coupons | 1 | 1 | 3 | Fraction of a cent → rounded to the nearest cent | 100 % coupon makes it free vs. rejected |

Subtasks marked declarative (types and constants only; never a NON_MILESTONE pause): US0 1, US2 1, US3 1, US4 2,
US5 1, US6 2.

## The stories

### US1 Flash-sale reservation
*As a customer during a flash sale, I want to reserve the items in my cart, so that nobody else can buy them while I
check out.*
- A reservation takes the quantity out of the available stock straight away.
- If an item has run out, I am told that it is out of stock (409), not that it does not exist. ← **flaw**
- The shop keeps selling everything that is still in stock.

Subtasks: types and 409 error · reservation and stock lookup · checkout handler · route, tests, docs.
**Flawed:** at stock 0 the product is removed. Seen by: sell the last 2, order 1 more → 404 instead of 409.
**Emergent:** a request with an unknown field (ignored or rejected with 400).

### US2 Payment notifications
*As a shop owner, I want the payment endpoint to credit a customer's account when a payment event arrives, so that
customers see their balance update. The provider may deliver the same event more than once, and processing can
fail temporarily.*
- The account is credited with exactly the amount the customer paid, to the cent. ← **flaw**
- An event that is delivered more than once credits the account only once.
- A temporary failure is retried; an invalid event is rejected and never credited.

Subtasks: types and event log contract · parsing and crediting in cents · repeated deliveries and retry · endpoint,
tests, docs.
**Flawed:** cents by rounding down a float. Seen by: `"0.29"`, `"4.35"`, `"1.15"` → 577 instead of 579.
**Emergent:** an event of type `payment.refunded`.

### US3 Seller settings
*As a shop owner, I want each seller to be able to customize its own features and limits, so that sellers can differ
from the shop defaults where they need to.*
- A seller that sets no value of its own gets the shop default for it.
- A seller's own value replaces the default, for each feature and each limit separately.
- An operation that would take a seller over one of its limits is rejected (429) and does not run.
- An operation that adds several items at once is rejected unless all of them fit. ← **flaw**

Subtasks: types and defaults · merging overrides · 429 error and limit check · tests, docs.
**Flawed:** a bulk operation counts as one. Seen by: 98 of 100 products, import 5 → runs instead of 429.
**Emergent:** an override for a limit that does not exist.

### US4 Outage refunds
*As a shop owner, I want outages of the shop refunded on our customers' monthly bills, so that customers are
compensated when the shop was down for too long.*
- An outage longer than the allowed outage time earns a refund on the bill; a shorter one earns none.
- The longer the outage, the higher the refund level it reaches.
- The part of an outage that lies inside the billing month counts, even if it began before or ended after it.
  ← **flaw**
- The refund policy writes its durations the way people do, such as "30m" or "1h 30m".

Subtasks: duration parser · refund policy and bill types · bill generator · tests, docs.
**Flawed:** outages crossing the month are skipped. Seen by: a 2-hour outage starting 1 hour before the month ends →
no refund.
**Emergent:** a unit in capitals (`"2H"`).

### US5 Request limit
*As a shop owner, I want each client limited to a number of requests per minute, so that no single client can
overload the shop's server.*
- A client that is over its limit gets 429 with a Retry-After header that says when to try again, and its request is
  not handled.
- Clients are limited separately: one client over its limit does not slow down another.
- A client gets through again as soon as its earlier accepted requests have dropped out of the last minute, even if it
  kept retrying in the meantime. ← **flaw**

Subtasks: types and defaults · 429 helper and client identification · counting recent requests · wrapper, tests,
docs.
**Flawed:** rejected requests are recorded too. Seen by: limit 1 per 1000 ms, allowed at 0, retry at 300 rejected →
at 1000 ms rejected instead of allowed.
**Emergent:** a limit of 0.

### US6 Coupons
*As a shopper, I want to apply a coupon to my order, so that I pay the discounted price.*
- A percentage coupon takes that share off the order; a fixed coupon takes off a fixed amount.
- A coupon never makes an order cost less than nothing.
- A 100 % coupon makes the order free. ← **flaw**
- A percentage coupon above 100 % is rejected as invalid.

Subtasks: discount calculation · coupon and order types · order summary · tests, docs.
**Flawed:** percentages from 100 on are rejected. Seen by: 2400 cents with a 100 % coupon → rejected instead of 0.
**Emergent:** a percentage of 12.5.

### US0 Greeting formatter (practice, no variants)
*As a user, I want the app to greet me by name, so that it feels friendly.*
- I am greeted by my preferred name if I have one, otherwise by my first name.
- A user without a name cannot be greeted: the app reports an invalid request.

Subtasks: types · formatter · greeting several users · tests, docs. Always paused after subtask 2.
