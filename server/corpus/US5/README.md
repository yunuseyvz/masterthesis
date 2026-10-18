# api-gateway

Request filters for the public API gateway.

## Getting started

Requires Node.js 24 or newer. There is no build step: TypeScript files run directly.

```bash
npm test
```

runs the unit tests in `test/` with Node's built-in test runner. To run a single test file:

```bash
node --test test/limiter.test.ts
```

## Layout

- `src/` – application code
- `test/` – unit tests

## Conventions

- Timestamps are milliseconds; callers pass `now` in, the code never reads the clock itself.
- Imports use explicit `.ts` extensions.
