/**
 * The observer seam. The engine depends on the {@link Trigger} contract, not on
 * IntersectionObserver directly — so alternative triggers (scroll events,
 * mutation-based, manual) can be swapped in later without touching the engine.
 *
 * The default IntersectionObserver trigger ships here because it is the 90% case
 * and is tiny. It is SSR-safe: {@link createIntersectionTrigger} returns `null`
 * when no IntersectionObserver exists, and the engine treats that as a no-op.
 */

export interface IntersectionTriggerOptions {
  readonly root?: Element | Document | null;
  readonly rootMargin?: string;
  readonly threshold?: number | readonly number[];
  /** Invoked whenever the observed target enters the viewport/root. */
  readonly onIntersect: () => void;
}

/** A minimal trigger: observe one element, and disconnect everything. */
export interface Trigger {
  observe(target: Element): void;
  disconnect(): void;
}

/**
 * Creates an IntersectionObserver-backed {@link Trigger}, or `null` when there is
 * no DOM (server rendering, or an environment without IntersectionObserver).
 */
export function createIntersectionTrigger(options: IntersectionTriggerOptions): Trigger | null {
  if (typeof IntersectionObserver === 'undefined') return null;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          options.onIntersect();
          break;
        }
      }
    },
    {
      root: options.root ?? null,
      rootMargin: options.rootMargin,
      threshold: options.threshold as number | number[] | undefined,
    },
  );

  return {
    observe: (target) => observer.observe(target),
    disconnect: () => observer.disconnect(),
  };
}
