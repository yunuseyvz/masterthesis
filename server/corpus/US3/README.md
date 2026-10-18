# tenant-admin

Admin backend for per-tenant configuration and quotas.

## Getting started

Requires Node.js 24 or newer. There is no build step: TypeScript files run directly.

```bash
npm test
```

runs the unit tests in `test/` with Node's built-in test runner. To run a single test file:

```bash
node --test test/config.test.ts
```

## Layout

- `src/` – application code
- `test/` – unit tests

## Conventions

- Organization-wide defaults are shared by all tenants.
- Imports use explicit `.ts` extensions.
