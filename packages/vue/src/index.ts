import {
  createInfiniteScroll as createCore,
  type InfiniteScroll,
  type InfiniteScrollOptions,
  type InfiniteScrollSnapshot,
} from '@scrollstackjs/core';
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue';

/** What {@link useInfiniteScroll} returns. */
export interface UseInfiniteScrollReturn<TData, TPageParam> {
  /**
   * The live snapshot. In `<script setup>` read `state.value.pages`; in the
   * template it auto-unwraps, so `state.pages` works directly.
   */
  readonly state: ShallowRef<InfiniteScrollSnapshot<TData, TPageParam>>;
  /** A function ref for the sentinel: `<div :ref="target" />`. */
  readonly target: (el: Element | null) => void;
  /** Load the next page manually. */
  readonly loadNextPage: () => Promise<void>;
  /** Retry after an error. */
  readonly retry: () => Promise<void>;
  /** Reset to the initial state. */
  readonly reset: () => void;
  /** Escape hatch: the underlying engine (events, plugins). */
  readonly engine: InfiniteScroll<TData, TPageParam>;
}

/**
 * Vue 3 binding for `@scrollstackjs/core`. The engine is created once per call and
 * its snapshot is mirrored into a `shallowRef` (cheap — the engine already hands
 * out stable, wholesale-replaced snapshots). Teardown is wired to the active
 * effect scope, so it cleans up automatically when the component unmounts.
 *
 * @example
 * <script setup lang="ts">
 * import { useInfiniteScroll } from '@scrollstackjs/vue';
 * const { state, target, retry } = useInfiniteScroll({
 *   initialPageParam: 0,
 *   fetchPage: async ({ pageParam, signal }) =>
 *     (await fetch(`/api/items?page=${pageParam}`, { signal })).json(),
 *   getNextPageParam: (last) => last.nextCursor,
 * });
 * </script>
 *
 * <template>
 *   <ul>
 *     <li v-for="item in state.pages.flatMap(p => p.items)" :key="item.id">{{ item.name }}</li>
 *     <li v-if="state.hasNextPage" :ref="target">{{ state.isFetchingNextPage ? 'Loading…' : '' }}</li>
 *   </ul>
 * </template>
 */
export function useInfiniteScroll<TData, TPageParam = number>(
  options: InfiniteScrollOptions<TData, TPageParam>,
): UseInfiniteScrollReturn<TData, TPageParam> {
  const engine = createCore(options);
  const state = shallowRef(engine.getSnapshot());

  const unsubscribe = engine.subscribe(() => {
    state.value = engine.getSnapshot();
  });

  // Vue invokes function refs on *every* patch, not just mount/unmount. Observing
  // again on each one would build a fresh IntersectionObserver, and a fresh
  // observer reports its initial intersection immediately — so a sentinel that is
  // still on screen would refetch on every render, blowing past `retry` limits.
  // Tracking the observed node makes repeat calls with the same element a no-op.
  let observed: Element | null = null;

  const target = (el: Element | null): void => {
    if (el === observed) return;
    observed = el;
    if (el) engine.observeTarget(el);
    else engine.destroyObserver();
  };

  onScopeDispose(() => {
    unsubscribe();
    engine.destroy();
  });

  return {
    state,
    target,
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
