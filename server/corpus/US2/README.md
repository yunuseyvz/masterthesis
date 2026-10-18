# payments-service

Receives payment-provider webhooks and credits customer accounts.

## Getting started

Requires Node.js 24 or newer. There is no build step: TypeScript files run directly.

```bash
npm test
```

runs the unit tests in `test/` with Node's built-in test runner. To run a single test file:

```bash
node --test test/webhook.test.ts
```

## Layout

- `src/` – application code
- `test/` – unit tests

## Conventions

- Amounts are integer cents.
- Event handlers are async functions.
- Imports use explicit `.ts` extensions.
