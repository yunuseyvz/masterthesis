/** Deterministic id generator, so tests and replays produce the same ids. */
export function createIdGenerator(prefix: string, start = 1): () => string {
  let next = start;
  return () => `${prefix}_${String(next++).padStart(4, "0")}`;
}
