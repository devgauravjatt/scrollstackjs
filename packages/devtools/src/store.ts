/**
 * The headless half of the devtools. Everything the panel shows is derived here:
 * the live engine snapshot, a capped timeline of lifecycle events, and the phase
 * label that disambiguates a first-load failure from a load-more failure.
 *
 * This module never touches the DOM, so it runs under SSR and in `node` tests.
 * Rendering lives in `panel.ts` — same split the adapters use (ADR-008), which is
 * what lets a React or Vue panel be written later without moving any logic.
 */

import type { InfiniteScroll, InfiniteScrollSnapshot } from '@scrollstackjs/core';

/** Lifecycle events the engine emits, mirrored into the timeline. */
export type DevtoolsEventType = 'loadStart' | 'success' | 'error' | 'reset';

/** One row in the timeline. */
export interface DevtoolsEvent<TPageParam> {
  /** Monotonic id, unique per store. Newer events have higher ids. */
  readonly id: number;
  readonly type: DevtoolsEventType;
  /** `Date.now()` when the event was recorded. */
  readonly at: number;
  /** The page parameter involved, or `null` for `reset`. */
  readonly pageParam: TPageParam | null;
  /** Milliseconds from the matching `loadStart`. `null` unless `success`/`error`. */
  readonly durationMs: number | null;
  /** `pages.length` after a successful load. `null` otherwise. */
  readonly pageCount: number | null;
  /** Human-readable error text. `null` unless `type` is `'error'`. */
  readonly message: string | null;
  /** `failureCount` at the time of an error. `null` otherwise. */
  readonly failureCount: number | null;
}

/**
 * A single label for "what is going on right now", collapsing the `status` ×
 * `fetchStatus` matrix into the six cases worth naming.
 *
 * `loadMoreFailed` is the one that earns this type: per ADR-003 a failed *later*
 * page leaves `status: 'success'` with the data intact, which reads like a bug
 * unless it is labelled.
 */
export type DevtoolsPhase =
  | 'idle'
  | 'firstLoad'
  | 'firstLoadFailed'
  | 'ready'
  | 'fetchingNext'
  | 'loadMoreFailed'
  | 'complete';

/** The devtools state, shaped like a core snapshot: stable reference until it changes. */
export interface DevtoolsState<TData, TPageParam> {
  readonly snapshot: InfiniteScrollSnapshot<TData, TPageParam>;
  /** Newest first, capped at `maxEvents`. */
  readonly events: readonly DevtoolsEvent<TPageParam>[];
  readonly phase: DevtoolsPhase;
}

/** Options for {@link createDevtoolsStore}. */
export interface DevtoolsStoreOptions {
  /** Ring-buffer size for the timeline. Default `100`. Oldest rows drop first. */
  readonly maxEvents?: number;
}

/** A read-only view of one engine, plus a timeline. Detach with {@link DevtoolsStore.destroy}. */
export interface DevtoolsStore<TData, TPageParam> {
  /** Current state. Same reference until something actually changes. */
  getSnapshot(): DevtoolsState<TData, TPageParam>;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Empties the timeline. Does not touch engine state. */
  clearEvents(): void;
  /** Unsubscribes from the engine. The store stops updating; the engine is untouched. */
  destroy(): void;
  /** The engine being observed, for the panel's manual controls. */
  readonly engine: InfiniteScroll<TData, TPageParam>;
}

const DEFAULT_MAX_EVENTS = 100;

/**
 * Best-effort human text for an unknown error value, without relying on implicit
 * `toString` (`typescript/no-base-to-string` is an error in this repo).
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  if (typeof error === 'number' || typeof error === 'boolean') return `${error}`;
  if (error === null) return 'null';
  if (error === undefined) return 'undefined';
  try {
    return JSON.stringify(error) ?? 'unserializable error';
  } catch {
    return 'unserializable error';
  }
}

/** Collapses `status` × `fetchStatus` × `error` into a single label. */
export function derivePhase<TData, TPageParam>(
  snapshot: InfiniteScrollSnapshot<TData, TPageParam>,
): DevtoolsPhase {
  if (snapshot.isLoading) return 'firstLoad';
  if (snapshot.isError) return 'firstLoadFailed';
  // ADR-003: a later-page failure keeps `status: 'success'` and the loaded pages.
  if (snapshot.error !== null && snapshot.pages.length > 0 && !snapshot.isFetching) {
    return 'loadMoreFailed';
  }
  if (snapshot.isFetchingNextPage) return 'fetchingNext';
  if (snapshot.isIdle) return 'idle';
  if (!snapshot.hasNextPage && snapshot.pages.length > 0) return 'complete';
  return 'ready';
}

/**
 * Attaches a read-only observer to an engine.
 *
 * @example
 * ```ts
 * const store = createDevtoolsStore(scroll, { maxEvents: 50 })
 * store.subscribe(() => {
 *   const { phase, events } = store.getSnapshot()
 *   render(phase, events)
 * })
 * ```
 */
export function createDevtoolsStore<TData, TPageParam>(
  engine: InfiniteScroll<TData, TPageParam>,
  options: DevtoolsStoreOptions = {},
): DevtoolsStore<TData, TPageParam> {
  const maxEvents = Math.max(1, options.maxEvents ?? DEFAULT_MAX_EVENTS);

  let events: readonly DevtoolsEvent<TPageParam>[] = [];
  let state: DevtoolsState<TData, TPageParam> = buildState(engine.getSnapshot(), events);
  let nextId = 1;
  // The engine fetches one page at a time (`run()` bails while fetching), so a
  // single pending start is enough to pair success/error back to its loadStart.
  let pendingStartedAt: number | null = null;
  let destroyed = false;

  const listeners = new Set<() => void>();

  function buildState(
    snapshot: InfiniteScrollSnapshot<TData, TPageParam>,
    timeline: readonly DevtoolsEvent<TPageParam>[],
  ): DevtoolsState<TData, TPageParam> {
    return { snapshot, events: timeline, phase: derivePhase(snapshot) };
  }

  function commit(): void {
    state = buildState(engine.getSnapshot(), events);
    for (const listener of listeners) listener();
  }

  function record(event: Omit<DevtoolsEvent<TPageParam>, 'id' | 'at'>): void {
    if (destroyed) return;
    const row: DevtoolsEvent<TPageParam> = { ...event, id: nextId++, at: Date.now() };
    // Newest first; the ring buffer drops from the tail.
    events = [row, ...events].slice(0, maxEvents);
    commit();
  }

  function since(): number | null {
    if (pendingStartedAt === null) return null;
    const elapsed = Date.now() - pendingStartedAt;
    pendingStartedAt = null;
    return elapsed;
  }

  const unsubscribers: Array<() => void> = [
    engine.subscribe(() => {
      if (destroyed) return;
      // Snapshots are referentially stable (ADR-004), so this is a cheap guard.
      if (engine.getSnapshot() === state.snapshot) return;
      commit();
    }),

    engine.on('loadStart', ({ pageParam }) => {
      pendingStartedAt = Date.now();
      record({
        type: 'loadStart',
        pageParam,
        durationMs: null,
        pageCount: null,
        message: null,
        failureCount: null,
      });
    }),

    engine.on('success', ({ pageParam, pages }) => {
      record({
        type: 'success',
        pageParam,
        durationMs: since(),
        pageCount: pages.length,
        message: null,
        failureCount: null,
      });
    }),

    engine.on('error', ({ pageParam, error }) => {
      record({
        type: 'error',
        pageParam,
        durationMs: since(),
        pageCount: null,
        message: describeError(error),
        failureCount: engine.getSnapshot().failureCount,
      });
    }),

    engine.on('reset', () => {
      pendingStartedAt = null;
      record({
        type: 'reset',
        pageParam: null,
        durationMs: null,
        pageCount: null,
        message: null,
        failureCount: null,
      });
    }),
  ];

  return {
    engine,
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clearEvents() {
      events = [];
      commit();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const off of unsubscribers) off();
      unsubscribers.length = 0;
      listeners.clear();
    },
  };
}
