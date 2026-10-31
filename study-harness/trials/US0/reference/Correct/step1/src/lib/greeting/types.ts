/** How warm a greeting sounds. Defaults to "friendly". */
export type GreetingTone = "friendly" | "formal";

/** A person the app can greet, together with the preferences the greeting needs. */
export interface GreetingUser {
  /** Full name, for example "Ada Lovelace". */
  name: string;
  /** Name to address the user by instead of the first word of `name`. */
  preferredName?: string;
  /** Tone of the greeting. Defaults to "friendly". */
  tone?: GreetingTone;
}
