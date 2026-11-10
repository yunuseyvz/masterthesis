## Step outline: greeting

1. Greeting types in `src/lib/greeting/types.ts`: `type GreetingTone = "friendly" | "formal";` and a `GreetingUser`
   with a required `name: string` (the full name), an optional `preferredName?: string` and an optional
   `tone?: GreetingTone` (default friendly).
2. The greeting formatter in `src/lib/greeting/greeting.ts`: `formatGreeting(user)` returns
   `Hello, <name>!` in the friendly tone, where `<name>` is the preferred name if set, otherwise the first word of
   the full name; a preferred name that is blank counts as not set. In the formal tone it returns
   `Good day, <full name>.`, also when a preferred name is set. A blank name is a `ValidationError`.
3. A helper in `src/lib/greeting/batch.ts`: `greetAll(users)` greets several users at once with the formatter and
   returns the greetings in the order the users are given; a user who cannot be greeted makes the whole call fail.
4. Unit tests in `test/greeting.test.ts`, a short README section, then `npm test`.
