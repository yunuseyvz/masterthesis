Here is the plan for the greeting, in four steps.

1. **Greeting types**: `src/lib/greeting/types.ts` with `GreetingTone` and `GreetingUser`, the shape the other steps share.
2. **The formatter**: `src/lib/greeting/greeting.ts` with `formatGreeting`, which turns one user into a greeting.
3. **Several users at once**: `src/lib/greeting/batch.ts` with `greetAll`, built on the formatter.
4. **Tests and docs**: `test/greeting.test.ts` and a section in `README.md`, then `npm test`.
