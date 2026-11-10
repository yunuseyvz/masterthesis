# US0: Practice: Greeting Formatter

Platz: Milestone Schritt 2, kein Flaw (Übung)

## Öffentlich

### Story

As a user, I want the app to greet me by name, so that it feels friendly. This is a practice story: take your time to explore the interface.

Acceptance criteria:
- I am greeted by my preferred name if I have one, otherwise by my first name.
- A user without a name cannot be greeted: the app reports an invalid request.

### Public Plan

Here is the plan for the greeting, in four steps.

1. **Greeting types**: `src/lib/greeting/types.ts` with `GreetingTone` and `GreetingUser`, the shape the other steps share.
2. **The formatter**: `src/lib/greeting/greeting.ts` with `formatGreeting`, which turns one user into a greeting.
3. **Several users at once**: `src/lib/greeting/batch.ts` with `greetAll`, built on the formatter.
4. **Tests and docs**: `test/greeting.test.ts` and a section in `README.md`, then `npm test`.

## Geheim

### Offener Fall (Milestone, Schritt 2)

- **Der Fall:** Ein Wunschname ist gesetzt, besteht aber nur aus Leerzeichen.
- **Warum die Story still ist:** Sie unterscheidet nur, ob jemand einen Wunschnamen hat oder nicht.
- **Vernünftige Lösungen:** wie fehlend behandeln (Vorname), als ungültig ablehnen oder unverändert ausgeben.
- **Im Secret Plan:** Ein leerer Wunschname zählt als nicht gesetzt, es wird der Vorname verwendet.
- **Baut darauf auf:** `batch.ts` (Schritt 3): `greetAll` gibt für jede Person eine Begrüßung zurück und bricht an einem leeren Wunschnamen nicht ab.

### Der Flaw

Keiner, das ist die Übung.

### Secret Plan

Correct-Variante, wie das Modell sie bekommt (`outline.md`).

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

### Bezug zum Bestandscode

Keiner nötig, es ist die Übung. `ValidationError` aus `errors.ts` wird nur importiert.

## Emergent

- **Der Fall:** Formaler Ton, im vollen Namen stehen zwei Leerzeichen (`"Ada  Lovelace"`).
- **Mögliche Ausgänge:** Leerzeichen bleiben, werden zusammengefasst, oder der Name wird abgelehnt.
- **Skript:** `formatGreeting({ name: "Ada  Lovelace", tone: "formal" })`.

## Fragen

### Verhaltensfragen (je eine zu Schritt 1, 2, 3)

1. Which tones can a greeting have?
   Optionen: friendly or formal / friendly, formal or casual / Any text / Only formal
   Antwort: friendly or formal
2. formatGreeting is called with { name: "Grace Hopper", preferredName: "Amazing Grace" }. What does it return?
   Optionen: Hello, Amazing Grace! / Hello, Grace! / Good day, Grace Hopper. / Hello, Grace Hopper!
   Antwort: Hello, Amazing Grace!
3. What does greetAll return for an empty list of users?
   Optionen: An empty list / An error / undefined / A list with one empty greeting
   Antwort: An empty list

### Understanding-Items

1. **Milestone, offener Fall** (Schritt 2): A user named "Ada Lovelace" has a preferred name that is only spaces. Which greeting do they get?
   Optionen: Hello, Ada! / Hello,    ! / It is rejected as an invalid request / Hello, Ada Lovelace!
   Antwort in der Referenz: Hello, Ada!
2. **Verhalten** (Schritt 2): A user with the formal tone has the full name "Ada Lovelace" and the preferred name "Ada". Which greeting do they get?
   Optionen: Good day, Ada Lovelace. / Good day, Ada. / Hello, Ada! / Hello, Ada Lovelace!
   Antwort in der Referenz: Good day, Ada Lovelace.
3. **Emergent** (Schritt 2): A user with the formal tone is named "Ada  Lovelace", with two spaces between the names. Which greeting do they get?
   Optionen: Good day, Ada  Lovelace. (both spaces kept) / Good day, Ada Lovelace. (one space) / Hello, Ada! / It is rejected as an invalid request
   Antwort in der Referenz: Good day, Ada  Lovelace. (both spaces kept)
4. **Milestone, Abhängigkeit** (Schritt 3): greetAll gets three users; the second has a preferred name that is only spaces. What does it return?
   Optionen: Three greetings, the second by first name / An error, and no greetings / Two greetings: the second user is skipped / Three greetings, the second without a name
   Antwort in der Referenz: Three greetings, the second by first name
5. **Zusammenspiel** (Schritt 3): greetAll gets three users; the second has a blank name. What does it return?
   Optionen: Nothing: it fails with an invalid-request error / Two greetings: the second user is skipped / Three greetings, the second without a name / Three greetings, the second "Hello, there!"
   Antwort in der Referenz: Nothing: it fails with an invalid-request error
