# Plan: greet the user by name

## Context

- `shopfront` keeps business logic in `src/lib/` (no React, testable with `node --test`), one folder or file per area.
- There is no greeting logic yet. The README lists the modules under "Layout".

## Approach

A small `src/lib/greeting/` module with a formatter and a helper for several users, plus unit tests.

## Steps

### 1. Add greeting types
- `src/lib/greeting/types.ts`: `GreetingOptions { name: string; formal?: boolean }`.

### 2. Implement the greeting formatter
- `src/lib/greeting/greeting.ts`: `formatGreeting(opts: GreetingOptions): string`.
- Trims the name. Informal: `Hi <name>!`; formal: `Dear <name>,`.
- An empty name falls back to a generic greeting.

### 3. Add a helper that greets several users
- `src/lib/greeting/batch.ts`: `greetAll(names: string[], formal = false): string[]`, one greeting per name via `formatGreeting`.

### 4. Add unit tests for greetings
- `test/greeting.test.ts`: informal, formal and empty-name cases.
- README: add `greeting/` under "Layout".

## Verification

`npm test` (or `node --test test/greeting.test.ts`).

Shall I go ahead?
