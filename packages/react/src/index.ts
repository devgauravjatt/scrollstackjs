import {
  createInfiniteScroll,
  type InfiniteScroll,
  type InfiniteScrollOptions,
  type InfiniteScrollSnapshot,
} from '@scrollstackjs/core';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/** Everything the snapshot exposes, plus the controls and the sentinel ref. */
export interface UseInfiniteScrollResult<TData, TPageParam> extends InfiniteScrollSnapshot<
  TData,
  TPageParam
> {
  /** Attach to your sentinel element: `<div ref={ref} />`. Intersection loads the next page. */
  readonly ref: (node: Element | null) => void;
  /** Manually load the next page. */
  readonly loadNextPage: () => Promise<void>;
  /** Retry after an error. */
  readonly retry: () => Promise<void>;
  /** Reset to the initial state. */
  readonly reset: () => void;
  /** Escape hatch: the underlying engine, if you need events or plugins. */
  readonly engine: InfiniteScroll<TData, TPageParam>;
}

/**
 * React binding for `@scrollstackjs/core`. The engine is created once and bound
 * with `useSyncExternalStore`, so it is concurrent-safe and SSR-safe out of the box
 * (the server renders the idle snapshot; the client hydrates and loads on intersection).
 *
 * > v0 note: options are read once, when the hook mounts. Changing `fetchPage`
 * > or `getNextPageParam` across renders will not re-create the engine — call
 * > `reset()`, or remount via a `key`, if the data source changes. Reactive
 * > options are on the adapter roadmap.
 *
 * @example
 * function Feed() {
 *   const { pages, ref, isFetchingNextPage, hasNextPage } = useInfiniteScroll({
 *     initialPageParam: 0,
 *     fetchPage: async ({ pageParam, signal }) =>
 *       (await fetch(`/api/items?page=${pageParam}`, { signal })).json(),
 *     getNextPageParam: (last, all) => (last.hasMore ? all.length : null),
 *   });
 *   return (
 *     <>
 *       {pages.flatMap((p) => p.items).map((item) => <Row key={item.id} {...item} />)}
 *       {hasNextPage && <div ref={ref}>{isFetchingNextPage ? 'Loading…' : ''}</div>}
 *     </>
 *   );
 * }
 */
export function useInfiniteScroll<TData, TPageParam = number>(
  options: InfiniteScrollOptions<TData, TPageParam>,
): UseInfiniteScrollResult<TData, TPageParam> {
  const engineRef = useRef<InfiniteScroll<TData, TPageParam> | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createInfiniteScroll(options);
  }
  const engine = engineRef.current;

  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot, // server snapshot — idle, hydration-safe
  );

  const ref = useCallback(
    (node: Element | null) => {
      if (node) engine.observeTarget(node);
      else engine.destroyObserver();
    },
    [engine],
  );

  useEffect(() => () => engine.destroy(), [engine]);

  return {
    ...snapshot,
    ref,
    loadNextPage: engine.loadNextPage,
    retry: engine.retry,
    reset: engine.reset,
    engine,
  };
}

export type {
  InfiniteScrollOptions,
  InfiniteScrollSnapshot,
  InfiniteScroll,
} from '@scrollstackjs/core';
