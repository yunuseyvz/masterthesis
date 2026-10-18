# billing-core

Billing helpers for SLA credits and invoices.

## Getting started

Requires Node.js 24 or newer. There is no build step: TypeScript files run directly.

```bash
npm test
```

runs the unit tests in `test/` with Node's built-in test runner. To run a single test file:

```bash
node --test test/duration.test.ts
```

## Layout

- `src/` – application code
- `test/` – unit tests

## Conventions

- Durations are handled in milliseconds internally.
- Imports use explicit `.ts` extensions.
