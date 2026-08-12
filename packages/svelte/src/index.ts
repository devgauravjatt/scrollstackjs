import {
  createInfiniteScroll as createCore,
  type InfiniteScroll,
  type InfiniteScrollOptions,
  type InfiniteScrollSnapshot,
} from '@scrollstackjs/core';
import type { Readable } from 'svelte/store';

/**
 * A Svelte store (so `$scroll` gives you the snapshot) with extra members:
 * a `target` action for the sentinel, the controls, and the raw engine.
 */
export interface ScrollStore<TData, TPageParam> extends Readable<
  InfiniteScrollSnapshot<TData, TPageParam>
> {
  /** Svelte action: `<div use:scroll.target />`. Intersection loads the next page. */
  target(node: Element): { destroy(): void };
  /** Load the next page manually. */
  loadNextPage(): Promise<void>;
  /** Retry after an error. */
  retry(): Promise<void>;
  /** Reset to the initial state. */
  reset(): void;
  /** Full teardown — call from `onDestroy(scroll.destroy)`. */
  destroy(): void;
  /** Escape hatch: the underlying engine (events, plugins). */
  readonly engine: InfiniteScroll<TData, TPageParam>;
}

/**
 * Svelte binding for `@scrollstackjs/core`. Returns a value that is both a Svelte
 * store and a small controller — no framework runtime is imported, so the adapter
 * stays tiny and works in Svelte 4 and 5 alike.
 *
 * @example
 * <script lang="ts">
 *   import { onDestroy } from 'svelte';
 *   import { createInfiniteScroll } from '@scrollstackjs/svelte';
 *
 *   const scroll = createInfiniteScroll({
 *     initialPageParam: 0,
 *     fetchPage: async ({ pageParam, signal }) =>
 *       (await fetch(`/api/items?page=${pageParam}`, { signal })).json(),
 *     getNextPageParam: (last) => last.nextCursor,
 *   });
 *   const { target } = scroll;
 *   onDestroy(scroll.destroy);
 * </script>
 *
 * <ul>
 *   {#each $scroll.pages.flatMap((p) => p.items) as item (item.id)}
 *     <li>{item.name}</li>
 *   {/each}
 *   {#if $scroll.hasNextPage}
 *     <li use:target>{$scroll.isFetchingNextPage ? 'Loading…' : ''}</li>
 *   {/if}
 * </ul>
 */
export function createInfiniteScroll<TData, TPageParam = number>(
  options: InfiniteScrollOptions<TData, TPageParam>,
): ScrollStore<TData, TPageParam> {
  const engine = createCore(options);

  // Svelte's store contract: call `run` with the current value immediately,
  // then again on every change; return an unsubscribe.
  function subscribe(run: (value: InfiniteScrollSnapshot<TData, TPageParam>) => void): () => void {
    run(engine.getSnapshot());
    return engine.subscribe(() => run(engine.getSnapshot()));
  }

  function target(node: Element): { destroy(): void } {
    engine.observeTarget(node);
    return {
      destroy() {
        engine.destroyObserver();
      },
    };
  }

  return {
    subscribe,
    target,
    loadNextPage: engine.loadNextPage,
    retry: engine.retry,
    reset: engine.reset,
    destroy: engine.destroy,
    engine,
  };
}

export type {
  InfiniteScrollOptions,
  InfiniteScrollSnapshot,
  InfiniteScroll,
} from '@scrollstackjs/core';
