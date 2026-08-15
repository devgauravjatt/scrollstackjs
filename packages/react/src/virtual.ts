import {
  createVirtualizer,
  type ScrollContainer,
  type ScrollToOptions,
  type Virtualizer,
  type VirtualizerOptions,
  type VirtualizerSnapshot,
} from '@scrollstackjs/virtual';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/** Options for {@link useVirtualizer} — the virtualizer's own, plus how to find the scroller. */
export interface UseVirtualizerOptions extends VirtualizerOptions {
  /**
   * The element (or `window`) that scrolls, when you already have it. Leave it out
   * and attach {@link UseVirtualizerResult.scrollRef} instead — use one or the other,
   * not both. `window` is the one you want for a page-scrolled list; pass
   * `typeof window === 'undefined' ? null : window` so it stays SSR-safe.
   */
  readonly scrollElement?: ScrollContainer | null;
}

/** Everything the snapshot exposes, plus the refs and the scroll controls. */
export interface UseVirtualizerResult extends VirtualizerSnapshot {
  /** Attach to the scrolling element: `<div ref={scrollRef} style={{ overflow: 'auto' }}>`. */
  readonly scrollRef: (node: Element | null) => void;
  /** Attach to every rendered row, together with `data-index={item.index}`. */
  readonly measureRef: (node: Element | null) => void;
  /** Scrolls the item at `index` into view. */
  readonly scrollToIndex: (index: number, options?: ScrollToOptions) => void;
  /** Scrolls the container to an absolute offset. */
  readonly scrollToOffset: (offset: number, options?: Pick<ScrollToOptions, 'behavior'>) => void;
  /** Escape hatch: the underlying virtualizer. */
  readonly virtualizer: Virtualizer;
}

/**
 * React binding for `@scrollstackjs/virtual`. The virtualizer is created once and
 * bound with `useSyncExternalStore`, so a scroll that doesn't change the rendered
 * window doesn't render the component either.
 *
 * Unlike `useInfiniteScroll`, options here are read on **every** render: `count`
 * grows as pages land, and a stale count would render the wrong window.
 *
 * @example
 * function Rows({ rows }: { rows: Row[] }) {
 *   const { items, totalSize, scrollRef, measureRef } = useVirtualizer({
 *     count: rows.length,
 *     estimateSize: () => 48,
 *   });
 *   return (
 *     <div ref={scrollRef} style={{ overflow: 'auto', height: 400 }}>
 *       <div style={{ height: totalSize, position: 'relative' }}>
 *         {items.map((item) => (
 *           <div
 *             key={item.key}
 *             data-index={item.index}
 *             ref={measureRef}
 *             style={{ position: 'absolute', top: 0, transform: `translateY(${item.start}px)` }}
 *           >
 *             {rows[item.index].label}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 */
export function useVirtualizer(options: UseVirtualizerOptions): UseVirtualizerResult {
  const virtualizerRef = useRef<Virtualizer | null>(null);
  if (virtualizerRef.current === null) {
    virtualizerRef.current = createVirtualizer(options);
  }
  const virtualizer = virtualizerRef.current;

  // Deliberately during render, before the snapshot is read: a page that landed in
  // this render must be laid out for this render. It is a no-op when nothing
  // changed, so the common re-render costs one object and a few comparisons.
  virtualizer.setOptions(options);

  const snapshot = useSyncExternalStore(
    virtualizer.subscribe,
    virtualizer.getSnapshot,
    virtualizer.getSnapshot, // server snapshot — derived from initialViewport
  );

  const { scrollElement } = options;
  useEffect(() => {
    if (scrollElement !== undefined) virtualizer.setScrollElement(scrollElement);
  }, [virtualizer, scrollElement]);

  useEffect(() => () => virtualizer.destroy(), [virtualizer]);

  const scrollRef = useCallback(
    (node: Element | null) => {
      virtualizer.setScrollElement(node);
    },
    [virtualizer],
  );

  const measureRef = useCallback(
    (node: Element | null) => {
      virtualizer.measureElement(node);
    },
    [virtualizer],
  );

  return {
    ...snapshot,
    scrollRef,
    measureRef,
    scrollToIndex: virtualizer.scrollToIndex,
    scrollToOffset: virtualizer.scrollToOffset,
    virtualizer,
  };
}

export type {
  ScrollAlignment,
  ScrollContainer,
  ScrollToOptions,
  VirtualItem,
  Virtualizer,
  VirtualizerOptions,
  VirtualizerSnapshot,
} from '@scrollstackjs/virtual';
