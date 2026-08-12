/** A map of event name -> payload type. `void` payloads may be emitted with no argument. */
export type EventMap = Record<string, unknown>;

/** A minimal, fully-typed event emitter. */
export interface Emitter<Events> {
  on<E extends keyof Events>(event: E, handler: (payload: Events[E]) => void): () => void;
  emit<E extends keyof Events>(
    event: E,
    ...args: Events[E] extends void ? [] : [payload: Events[E]]
  ): void;
  clear(): void;
}

/**
 * Creates a tiny typed emitter. Handlers are stored per-event in a `Set`, so
 * subscribing the same handler twice is idempotent and unsubscribe is O(1).
 */
export function createEmitter<Events>(): Emitter<Events> {
  const registry = new Map<keyof Events, Set<(payload: unknown) => void>>();

  return {
    on(event, handler) {
      let handlers = registry.get(event);
      if (!handlers) {
        handlers = new Set();
        registry.set(event, handlers);
      }
      const boxed = handler as (payload: unknown) => void;
      handlers.add(boxed);
      return () => {
        handlers.delete(boxed);
      };
    },
    emit(event, ...args) {
      const handlers = registry.get(event);
      if (!handlers) return;
      const payload = args[0];
      for (const handler of handlers) handler(payload);
    },
    clear() {
      registry.clear();
    },
  };
}
