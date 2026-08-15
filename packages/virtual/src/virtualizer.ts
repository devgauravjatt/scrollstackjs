import { invariant } from './errors';
import { computeRange, measure, offsetForIndex, totalSize, type LayoutSpec } from './layout';
import { applyScroll, listenToScroll, observeViewport, readOffset, readViewport } from './scroller';
import type {
  ItemKey,
  ScrollAlignment,
  ScrollContainer,
  ScrollToOptions,
  VirtualItem,
  Virtualizer,
  VirtualizerOptions,
  VirtualizerSnapshot,
} from './types';

/** The attribute {@link Virtualizer.measureElement} reads an item's index from. */
export const INDEX_ATTRIBUTE = 'data-index';

const DEFAULT_OVERSCAN = 3;
const DEFAULT_IS_SCROLLING_DELAY = 150;

/** Options with every default filled in, so the hot paths never test for `undefined`. */
interface ResolvedOptions {
  count: number;
  estimateSize: (index: number) => number;
  overscan: number;
  horizontal: boolean;
  paddingStart: number;
  paddingEnd: number;
  gap: number;
  getItemKey: (index: number) => ItemKey;
  scrollMargin: number;
  initialOffset: number;
  initialViewport: number;
  isScrollingDelay: number;
  adjustScrollOnMeasure: boolean;
}

const DEFAULTS: ResolvedOptions = {
  count: 0,
  estimateSize: () => 0,
  overscan: DEFAULT_OVERSCAN,
  horizontal: false,
  paddingStart: 0,
  paddingEnd: 0,
  gap: 0,
  getItemKey: (index) => index,
  scrollMargin: 0,
  initialOffset: 0,
  initialViewport: 0,
  isScrollingDelay: DEFAULT_IS_SCROLLING_DELAY,
  adjustScrollOnMeasure: true,
};

/**
 * Merges a partial update over resolved options. `undefined` means "leave it alone"
 * rather than "reset to default", so `setOptions({ count })` — the call every binding
 * makes on every render — can't quietly drop the rest of the configuration.
 */
function resolveOptions(
  partial: Partial<VirtualizerOptions>,
  base: ResolvedOptions,
): ResolvedOptions {
  return {
    count: partial.count ?? base.count,
    estimateSize: partial.estimateSize ?? base.estimateSize,
    overscan: partial.overscan ?? base.overscan,
    horizontal: partial.horizontal ?? base.horizontal,
    paddingStart: partial.paddingStart ?? base.paddingStart,
    paddingEnd: partial.paddingEnd ?? base.paddingEnd,
    gap: partial.gap ?? base.gap,
    getItemKey: partial.getItemKey ?? base.getItemKey,
    scrollMargin: partial.scrollMargin ?? base.scrollMargin,
    initialOffset: partial.initialOffset ?? base.initialOffset,
    initialViewport: partial.initialViewport ?? base.initialViewport,
    isScrollingDelay: partial.isScrollingDelay ?? base.isScrollingDelay,
    adjustScrollOnMeasure: partial.adjustScrollOnMeasure ?? base.adjustScrollOnMeasure,
  };
}

function readIndexAttribute(element: Element): number | null {
  const raw = element.getAttribute(INDEX_ATTRIBUTE);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Creates a headless virtualizer: it decides which slice of a long list is worth
 * rendering and where each row sits, and it owns nothing else. No markup, no styles,
 * no assumption about your framework — you get numbers and bind them yourself.
 *
 * It is a store in the same shape as the scroll engine (`subscribe` + `getSnapshot`
 * with referentially stable snapshots), which is what lets the framework adapters
 * bind it with the primitive they already use for the engine.
 *
 * @example
 * ```ts
 * import { createVirtualizer } from '@scrollstackjs/virtual'
 *
 * const virtualizer = createVirtualizer({ count: rows.length, estimateSize: () => 48 })
 * virtualizer.setScrollElement(document.querySelector('#scroller'))
 *
 * virtualizer.subscribe(() => {
 *   const { items, totalSize } = virtualizer.getSnapshot()
 *   spacer.style.height = `${totalSize}px`
 *   render(items) // position each row at `item.start`
 * })
 * ```
 */
export function createVirtualizer(options: VirtualizerOptions): Virtualizer {
  invariant(
    typeof options?.estimateSize === 'function',
    '[ScrollStack] `estimateSize` is required and must be a function.',
  );
  invariant(
    typeof options.count === 'number' && options.count >= 0,
    '[ScrollStack] `count` is required and must be a non-negative number.',
  );

  let opts = resolveOptions(options, DEFAULTS);

  const listeners = new Set<() => void>();
  /** Measured sizes, keyed by item key so they survive re-ordering (ADR-009). */
  const sizes = new Map<ItemKey, number>();
  /** Elements currently watched for size changes, keyed by index. */
  const elements = new Map<number, Element>();

  let measurements: VirtualItem[] = [];
  /** First index whose geometry is stale. `>= count` means the layout is current. */
  let staleFrom = 0;
  /** Bumped on every real re-layout, so a same-range snapshot still refreshes. */
  let version = 0;

  let container: ScrollContainer | null = null;
  let detachContainer: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;

  let scrollOffset = opts.initialOffset;
  let viewportSize = opts.initialViewport;
  let isScrolling = false;
  let scrollingTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  let snapshot: VirtualizerSnapshot = {
    items: [],
    totalSize: 0,
    startIndex: 0,
    endIndex: -1,
    count: opts.count,
    isScrolling: false,
  };
  let signature = '';

  function spec(): LayoutSpec {
    return {
      count: opts.count,
      paddingStart: opts.paddingStart,
      paddingEnd: opts.paddingEnd,
      gap: opts.gap,
      getKey: opts.getItemKey,
      getSize: (index, key) => sizes.get(key) ?? opts.estimateSize(index),
    };
  }

  /** Brings `measurements` up to date, doing nothing when it already is. */
  function relayout(): void {
    if (staleFrom >= opts.count && measurements.length === opts.count) return;
    measurements = measure(measurements, staleFrom, spec());
    staleFrom = opts.count;
    version++;
  }

  /**
   * Stops watching rows that scrolled out of the rendered window. Their measured
   * sizes stay in `sizes` — it is only the element references and their observer
   * registrations that would otherwise accumulate for the length of the list.
   */
  function pruneElements(startIndex: number, endIndex: number): void {
    if (elements.size === 0) return;
    for (const [index, element] of elements) {
      if (index >= startIndex && index <= endIndex) continue;
      elements.delete(index);
      resizeObserver?.unobserve(element);
    }
  }

  /**
   * Recomputes the rendered window and notifies subscribers — but only when the
   * output actually changed. Scrolling inside the current window produces the same
   * signature, so a fling costs binary searches, not renders (ADR-004, ADR-009).
   */
  function publish(): void {
    relayout();

    const range = computeRange(
      measurements,
      scrollOffset - opts.scrollMargin,
      viewportSize,
      opts.overscan,
    );
    const total = totalSize(measurements, spec());
    const next = `${version}:${range.startIndex}:${range.endIndex}:${total}:${isScrolling ? 1 : 0}`;
    if (next === signature) return;

    signature = next;
    pruneElements(range.startIndex, range.endIndex);
    snapshot = {
      items: measurements.slice(range.startIndex, range.endIndex + 1),
      totalSize: total,
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      count: opts.count,
      isScrolling,
    };
    for (const listener of listeners) listener();
  }

  function onScroll(): void {
    if (destroyed || container === null) return;
    scrollOffset = readOffset(container, opts.horizontal);

    if (opts.isScrollingDelay > 0) {
      isScrolling = true;
      if (scrollingTimer !== null) clearTimeout(scrollingTimer);
      scrollingTimer = setTimeout(() => {
        scrollingTimer = null;
        isScrolling = false;
        publish();
      }, opts.isScrollingDelay);
    }

    publish();
  }

  function onViewportResize(): void {
    if (destroyed || container === null) return;
    const next = readViewport(container, opts.horizontal);
    if (next === viewportSize) return;
    viewportSize = next;
    publish();
  }

  function setScrollElement(target: ScrollContainer | null): void {
    if (destroyed || target === container) return;

    detachContainer?.();
    detachContainer = null;
    container = target;

    if (container === null) {
      publish();
      return;
    }

    scrollOffset = readOffset(container, opts.horizontal);
    viewportSize = readViewport(container, opts.horizontal);

    const stopScroll = listenToScroll(container, onScroll);
    const stopResize = observeViewport(container, onViewportResize);
    detachContainer = () => {
      stopScroll();
      stopResize();
    };

    publish();
  }

  /**
   * Which item an observed element belongs to. The attribute wins when present —
   * a framework may reuse one DOM node for a different row — and the registry is
   * the fallback for callers that passed the index explicitly instead.
   */
  function indexOf(element: Element): number | null {
    const attribute = readIndexAttribute(element);
    if (attribute !== null) return attribute;
    for (const [index, candidate] of elements) {
      if (candidate === element) return index;
    }
    return null;
  }

  function ensureResizeObserver(): ResizeObserver | null {
    if (resizeObserver !== null) return resizeObserver;
    if (typeof ResizeObserver === 'undefined') return null;

    resizeObserver = new ResizeObserver((entries) => {
      if (destroyed) return;
      let changed = false;
      for (const entry of entries) {
        const index = indexOf(entry.target);
        if (index === null) continue;
        changed = record(index, entry.target) || changed;
      }
      if (changed) publish();
    });
    return resizeObserver;
  }

  /**
   * The element's size along the scroll axis — or `null` when it has no layout box
   * at all, which is not the same as being 0px tall.
   *
   * A row inside a `display: none` subtree, or one measured before the browser has
   * laid it out, reports 0 in *both* dimensions. Believing that collapses the row to
   * nothing, which moves the window onto rows that are also not laid out yet, which
   * collapses those too: a measure/render loop that never settles. Keeping the
   * estimate until the row really has a box is what breaks it.
   */
  function readSize(element: Element): number | null {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return opts.horizontal ? rect.width : rect.height;
  }

  /**
   * Stores an element's real size. Returns whether anything changed, so a batch of
   * resize entries publishes once instead of once per row.
   *
   * A row above the viewport that turns out taller (or shorter) than estimated would
   * push everything below it — including what the user is looking at. Compensating
   * the scroll offset by the same delta is what keeps the visible rows still.
   */
  function record(index: number, element: Element): boolean {
    if (index < 0 || index >= opts.count) return false;

    const size = readSize(element);
    if (size === null) return false;

    const key = opts.getItemKey(index);
    if (sizes.get(key) === size) return false;

    const current = measurements[index];
    const previousSize = current?.size ?? opts.estimateSize(index);
    sizes.set(key, size);
    staleFrom = Math.min(staleFrom, index);

    const delta = size - previousSize;
    const aboveViewport = current !== undefined && current.end <= scrollOffset - opts.scrollMargin;
    if (opts.adjustScrollOnMeasure && delta !== 0 && aboveViewport && container !== null) {
      scrollOffset += delta;
      applyScroll(container, scrollOffset, opts.horizontal, 'auto');
    }

    return true;
  }

  function measureElement(element: Element | null, index?: number): void {
    if (destroyed || element === null) return;

    const resolved = index ?? readIndexAttribute(element);
    invariant(
      resolved !== null,
      `[ScrollStack] measureElement could not tell which item this element is. ` +
        `Render it with a \`${INDEX_ATTRIBUTE}\` attribute (\`${INDEX_ATTRIBUTE}={item.index}\`), ` +
        'or pass the index as the second argument.',
    );
    if (resolved < 0 || resolved >= opts.count) return;

    const previous = elements.get(resolved);
    if (previous !== element) {
      if (previous !== undefined) resizeObserver?.unobserve(previous);
      elements.set(resolved, element);
      ensureResizeObserver()?.observe(element);
    }

    if (record(resolved, element)) publish();
  }

  function resetMeasurements(): void {
    if (sizes.size === 0) return;
    sizes.clear();
    staleFrom = 0;
    publish();
  }

  function setOptions(partial: Partial<VirtualizerOptions>): void {
    if (destroyed) return;

    const previous = opts;
    opts = resolveOptions(partial, previous);

    // A new count re-lays-out from the top rather than just appending the tail.
    // It looks wasteful for the append-only case infinite scrolling produces, but
    // a list can also grow at the *head*, and then every index maps to a different
    // key — the measured sizes have to be looked up again to follow their rows.
    // Measured sizes themselves are kept; this is O(count) arithmetic, once per page.
    if (
      opts.count !== previous.count ||
      opts.paddingStart !== previous.paddingStart ||
      opts.paddingEnd !== previous.paddingEnd ||
      opts.gap !== previous.gap
    ) {
      staleFrom = 0;
    }
    if (opts.horizontal !== previous.horizontal && container !== null) {
      scrollOffset = readOffset(container, opts.horizontal);
      viewportSize = readViewport(container, opts.horizontal);
      staleFrom = 0;
    }

    publish();
  }

  function getOffsetForIndex(index: number, align: ScrollAlignment = 'auto'): number {
    relayout();
    const clamped = Math.max(0, Math.min(index, opts.count - 1));
    return Math.max(
      0,
      offsetForIndex(measurements, clamped, align, scrollOffset, viewportSize, opts.scrollMargin),
    );
  }

  function scrollToOffset(
    offset: number,
    { behavior = 'auto' }: Pick<ScrollToOptions, 'behavior'> = {},
  ): void {
    if (destroyed) return;
    const target = Math.max(0, offset);

    if (container === null) {
      scrollOffset = target;
      publish();
      return;
    }

    applyScroll(container, target, opts.horizontal, behavior);
    // A scroll event will confirm this, but an instant scroll should be visible to
    // the very next `getSnapshot()` — a smooth one genuinely is still in flight.
    if (behavior === 'auto') {
      scrollOffset = readOffset(container, opts.horizontal);
      publish();
    }
  }

  function scrollToIndex(index: number, { align = 'auto', behavior }: ScrollToOptions = {}): void {
    if (destroyed || opts.count === 0) return;
    scrollToOffset(getOffsetForIndex(index, align), { behavior });
  }

  function destroy(): void {
    destroyed = true;
    detachContainer?.();
    detachContainer = null;
    container = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    elements.clear();
    if (scrollingTimer !== null) {
      clearTimeout(scrollingTimer);
      scrollingTimer = null;
    }
    listeners.clear();
  }

  publish();

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOptions,
    setScrollElement,
    measureElement,
    resetMeasurements,
    scrollToIndex,
    scrollToOffset,
    getOffsetForIndex,
    getScrollOffset: () => scrollOffset,
    getViewportSize: () => viewportSize,
    destroy,
  };
}
