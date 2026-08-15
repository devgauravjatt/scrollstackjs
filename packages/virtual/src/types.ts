/**
 * Public type surface for `@scrollstackjs/virtual`.
 *
 * The virtualizer answers one question — *which items are worth rendering right
 * now, and where do they sit* — and answers it through the same two methods every
 * ScrollStack store exposes: {@link Virtualizer.subscribe} and
 * {@link Virtualizer.getSnapshot}. That is deliberate: a framework binding for the
 * virtualizer is the same shape as a binding for the scroll engine (ADR-008), and
 * `useSyncExternalStore` works on it unchanged.
 */

/** Identity of a row. Defaults to its index; override with {@link VirtualizerOptions.getItemKey}. */
export type ItemKey = string | number;

/** Anything that scrolls: a scroll container, or the page itself. */
export type ScrollContainer = Element | Window;

/** How {@link Virtualizer.scrollToIndex} positions the item inside the viewport. */
export type ScrollAlignment = 'auto' | 'start' | 'center' | 'end';

/** One laid-out row. Positions are relative to the start of the list, not the document. */
export interface VirtualItem {
  /** Position in the full list. */
  readonly index: number;
  /** Stable identity — use it as the framework key so a re-ordered row keeps its DOM node. */
  readonly key: ItemKey;
  /** Offset of the item's leading edge from the start of the list, in pixels. */
  readonly start: number;
  /** `start + size`. */
  readonly end: number;
  /** Measured size when the row has been rendered and measured, the estimate otherwise. */
  readonly size: number;
}

/** Options for {@link createVirtualizer}. */
export interface VirtualizerOptions {
  /** How many items the list has in total. Grows as pages load — push it in with {@link Virtualizer.setOptions}. */
  readonly count: number;

  /**
   * Estimated size of the item at `index`, in pixels, along the scroll axis.
   * It only has to be in the right ballpark: a rendered row replaces its estimate
   * with a real measurement as soon as {@link Virtualizer.measureElement} sees it.
   */
  estimateSize(index: number): number;

  /**
   * Extra items rendered on each side of the visible window. Default `3`.
   * Higher trades memory for fewer blank frames while flinging.
   */
  readonly overscan?: number;

  /** Lay the list out along the x-axis instead of the y-axis. Default `false`. */
  readonly horizontal?: boolean;

  /** Space before the first item, in pixels. Default `0`. */
  readonly paddingStart?: number;
  /** Space after the last item, in pixels. Default `0`. */
  readonly paddingEnd?: number;
  /** Space between adjacent items, in pixels. Default `0`. */
  readonly gap?: number;

  /**
   * Identity of the item at `index`. Default: the index itself.
   *
   * Measurements are cached per key, so a stable key (a record id) keeps a measured
   * row's height when items are prepended or re-ordered. Index-keyed caches are
   * correct for append-only lists — which is what infinite scrolling produces.
   */
  getItemKey?(index: number): ItemKey;

  /**
   * Distance from the top of the scroll container to the top of the list, in pixels.
   * Only needed when the list does not start at offset 0 — a page-scrolled list under
   * a header, typically. Default `0`.
   */
  readonly scrollMargin?: number;

  /** Scroll offset assumed before a scroll container is attached (SSR, first paint). Default `0`. */
  readonly initialOffset?: number;
  /**
   * Viewport size assumed before a scroll container is attached, in pixels. Default `0`.
   * On the server this decides how many rows are rendered into the HTML — `0` renders
   * only the overscan, a realistic value renders a usable first screen.
   */
  readonly initialViewport?: number;

  /**
   * How long after the last scroll event {@link VirtualizerSnapshot.isScrolling}
   * stays `true`, in milliseconds. Default `150`. Set `0` to never report scrolling
   * (and skip the two extra renders per scroll burst).
   */
  readonly isScrollingDelay?: number;

  /**
   * When a row *above* the viewport turns out to be a different size than estimated,
   * compensate the scroll offset so the visible rows don't jump. Default `true`.
   */
  readonly adjustScrollOnMeasure?: boolean;
}

/**
 * An immutable snapshot of what to render. The same object reference is returned
 * from {@link Virtualizer.getSnapshot} until the *rendered output* changes, so it
 * is safe to feed straight into `useSyncExternalStore` (ADR-004).
 *
 * Scrolling within the current window produces no new snapshot and therefore no
 * re-render. Read {@link Virtualizer.getScrollOffset} if you need the live offset.
 */
export interface VirtualizerSnapshot {
  /** The items to render, in order. Position them with `item.start`. */
  readonly items: readonly VirtualItem[];
  /** Size of the whole list including padding — the height (or width) of your spacer element. */
  readonly totalSize: number;
  /** Index of the first rendered item (visible window minus overscan). */
  readonly startIndex: number;
  /** Index of the last rendered item, inclusive. `-1` when the list is empty. */
  readonly endIndex: number;
  /** Total number of items the virtualizer knows about. */
  readonly count: number;
  /** `true` between the first scroll event and `isScrollingDelay` ms after the last one. */
  readonly isScrolling: boolean;
}

/** Options for {@link Virtualizer.scrollToIndex} and {@link Virtualizer.scrollToOffset}. */
export interface ScrollToOptions {
  /** Where the item should land. `'auto'` (default) scrolls the shortest distance that reveals it. */
  readonly align?: ScrollAlignment;
  /** Forwarded to the platform scroll. Default `'auto'` (instant). */
  readonly behavior?: 'auto' | 'smooth';
}

/** The virtualizer instance returned by {@link createVirtualizer}. */
export interface Virtualizer {
  /** Returns the current snapshot (stable reference until the rendered output changes). */
  getSnapshot(): VirtualizerSnapshot;
  /** Subscribes to snapshot changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;

  /**
   * Merges new options. `count` is the one you will call every render — a loaded page
   * makes the list longer, and the virtualizer has no other way to hear about it.
   *
   * Changing `estimateSize` or `getItemKey` does *not* re-lay-out already measured
   * rows; call {@link Virtualizer.resetMeasurements} if you need that.
   */
  setOptions(options: Partial<VirtualizerOptions>): void;

  /**
   * Attaches the element (or `window`) that scrolls. Pass `null` to detach.
   * Safe to call repeatedly with the same target — it is a no-op. Without a container
   * the virtualizer reports the SSR window derived from `initialOffset` / `initialViewport`.
   */
  setScrollElement(target: ScrollContainer | null): void;

  /**
   * Records a rendered row's real size, replacing its estimate, and keeps watching it
   * for later size changes. Call it from a ref on every rendered row.
   *
   * The index comes from the element's `data-index` attribute unless you pass one.
   * `null` is ignored, so a framework ref cleanup can call this directly.
   */
  measureElement(element: Element | null, index?: number): void;

  /** Drops every measured size back to its estimate. Use after the list's contents change wholesale. */
  resetMeasurements(): void;

  /** Scrolls so the item at `index` is in view. No-op when the list is empty. */
  scrollToIndex(index: number, options?: ScrollToOptions): void;
  /** Scrolls the container to an absolute offset, clamped at 0. */
  scrollToOffset(offset: number, options?: Pick<ScrollToOptions, 'behavior'>): void;
  /** The offset {@link Virtualizer.scrollToIndex} would scroll to, without scrolling. */
  getOffsetForIndex(index: number, align?: ScrollAlignment): number;

  /** The live scroll offset, in pixels. Not part of the snapshot — reading it never causes a render. */
  getScrollOffset(): number;
  /** The measured viewport size along the scroll axis, in pixels. */
  getViewportSize(): number;

  /** Detaches listeners and observers. The virtualizer stops updating; the DOM is untouched. */
  destroy(): void;
}
