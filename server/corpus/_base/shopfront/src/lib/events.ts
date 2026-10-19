export type Listener<T> = (payload: T) => void;

export interface Emitter<T> {
  on(listener: Listener<T>): () => void;
  emit(payload: T): void;
}

export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<Listener<T>>();
  return {
    on(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    emit(payload) {
      for (const listener of [...listeners]) {
        listener(payload);
      }
    },
  };
}
