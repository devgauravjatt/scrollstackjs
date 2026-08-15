/**
 * The bridge between a virtualizer and a scroll engine.
 *
 * Virtualizing breaks the sentinel: `observeTarget` needs an element in the DOM,
 * and the whole point of a virtual list is that the element after the last row
 * isn't rendered — and when it is, it sits at the bottom of a spacer the user may
 * never scroll to. So the trigger moves from geometry to indices: once the rendered
 * window comes within `threshold` items of the end, ask for another page.
 */

import type { InfiniteScroll } from '@scrollstackjs/core';

import type { Virtualizer } from './types';

/** Options for {@link connectInfiniteScroll}. */
export interface ConnectInfiniteScrollOptions {
  /**
   * How close to the end of the list the rendered window must come before the next
   * page is requested, in items. Default `5`. Larger buys more time on a slow API at
   * the cost of loading pages the user may never reach.
   */
  readonly threshold?: number;
}

const DEFAULT_THRESHOLD = 5;

/**
 * Loads pages as the virtual window approaches the end of the list. Returns a
 * cleanup function; call it (or destroy either side) when the list goes away.
 *
 * Two guards keep this from turning into a fetch loop. A pending `error` is left
 * alone — the engine's own retry policy owns that decision (ADR-003), and re-asking
 * on every scroll frame would step straight over it; call `engine.retry()` to
 * resume. And one page is requested per `count`, so a batch that arrives before the
 * binding has pushed the new `count` in doesn't stack up requests for it.
 *
 * @example
 * ```ts
 * const engine = createInfiniteScroll({ ... })
 * const virtualizer = createVirtualizer({ count: 0, estimateSize: () => 64 })
 * const disconnect = connectInfiniteScroll(virtualizer, engine)
 * ```
 */
export function connectInfiniteScroll<TData, TPageParam>(
  virtualizer: Virtualizer,
  engine: InfiniteScroll<TData, TPageParam>,
  options: ConnectInfiniteScrollOptions = {},
): () => void {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  let requestedAtCount = -1;

  function check(): void {
    const { count, endIndex } = virtualizer.getSnapshot();
    const state = engine.getSnapshot();

    if (!state.hasNextPage || state.isFetching || state.error !== null) return;
    // An empty list has no window to run out of — that first page is this
    // connection's job too, since there is no sentinel to trigger it.
    if (count > 0 && endIndex < count - 1 - threshold) return;
    if (requestedAtCount === count) return;

    requestedAtCount = count;
    void engine.loadNextPage();
  }

  const stopWatchingRange = virtualizer.subscribe(check);
  // The engine side matters too: a finished fetch is what clears `isFetching` and
  // may leave the window still parked at the end of a barely-longer list.
  const stopWatchingEngine = engine.subscribe(check);
  // A reset empties the list, so the "one request per count" guard has to forget
  // what it asked for — and then start the list over, exactly as it did at mount.
  const stopWatchingReset = engine.on('reset', () => {
    requestedAtCount = -1;
    check();
  });

  check();

  return () => {
    stopWatchingRange();
    stopWatchingEngine();
    stopWatchingReset();
  };
}
