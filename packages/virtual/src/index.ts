/**
 * `@scrollstackjs/virtual` — headless list virtualization.
 *
 * Render 50 rows out of 50,000. The virtualizer works out which slice of the list
 * is on screen and where each row sits; you keep every decision about markup,
 * styling, and framework. It is a store in the same shape as the scroll engine
 * (`subscribe` + `getSnapshot`, referentially stable), so the adapters bind it with
 * the primitive they already use.
 *
 * - {@link createVirtualizer} — the virtualizer itself. Useful with or without the
 *   scroll engine; a static 50k-row table needs no pagination.
 * - {@link connectInfiniteScroll} — pairs one with a `@scrollstackjs/core` engine so
 *   pages load as the window nears the end, replacing the sentinel a virtual list
 *   cannot render.
 */

export { connectInfiniteScroll } from './connect';
export type { ConnectInfiniteScrollOptions } from './connect';

export { computeRange, findFirstVisible, measure, offsetForIndex, totalSize } from './layout';
export type { LayoutRange, LayoutSpec } from './layout';

export { createVirtualizer, INDEX_ATTRIBUTE } from './virtualizer';

export type {
  ItemKey,
  ScrollAlignment,
  ScrollContainer,
  ScrollToOptions,
  VirtualItem,
  Virtualizer,
  VirtualizerOptions,
  VirtualizerSnapshot,
} from './types';
