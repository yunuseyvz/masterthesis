# flash-shop

Inventory and checkout for flash sales.

## Getting started

Requires Node.js 24 or newer. There is no build step: TypeScript files run directly.

```bash
npm test
```

runs the unit tests in `test/` with Node's built-in test runner. To run a single test file:

```bash
node --test test/inventory.test.ts
```

## Layout

- `src/` – application code
- `test/` – unit tests

## Conventions

- Stock is tracked per SKU in memory; there is no database yet.
- Imports use explicit `.ts` extensions.
