import {
  createVirtualizer as createCore,
  type ScrollContainer,
  type ScrollToOptions,
  type Virtualizer,
  type VirtualizerOptions,
  type VirtualizerSnapshot,
} from '@scrollstackjs/virtual';
import type { Readable } from 'svelte/store';

/**
 * A Svelte store (so `$virtual` gives you the snapshot) with the actions and
 * controls attached: `use:virtual.scroller` on the scrolling element,
 * `use:virtual.measure` on every row.
 */
export interface VirtualStore extends Readable<VirtualizerSnapshot> {
  /** Svelte action for the scrolling element: `<div use:virtual.scroller>`. */
  scroller(node: Element): { destroy(): void };
  /** Svelte action for a rendered row: `<div use:virtual.measure data-index={item.index}>`. */
  measure(node: Element): { destroy(): void };
  /** Attach a scroller you already hold — `window`, for a page-scrolled list. */
  setScrollElement(target: ScrollContainer | null): void;
  /** Push a new item count in as pages land: `$: virtual.setCount(rows.length)`. */
  setCount(count: number): void;
  /** Scrolls the item at `index` into view. */
  scrollToIndex(index: number, options?: ScrollToOptions): void;
  /** Scrolls the container to an absolute offset. */
  scrollToOffset(offset: number, options?: Pick<ScrollToOptions, 'behavior'>): void;
  /** Full teardown — call from `onDestroy(virtual.destroy)`. */
  destroy(): void;
  /** Escape hatch: the underlying virtualizer. */
  readonly virtualizer: Virtualizer;
}

/**
 * Svelte binding for `@scrollstackjs/virtual`. Like the scroll store, it imports no
 * Svelte runtime — it just satisfies the store contract — so it works in Svelte 4
 * and 5 alike.
 *
 * @example
 * <script lang="ts">
 *   import { onDestroy } from 'svelte';
 *   import { createVirtualizer } from '@scrollstackjs/svelte/virtual';
 *
 *   export let rows: Row[];
 *   const virtual = createVirtualizer({ count: rows.length, estimateSize: () => 48 });
 *   $: virtual.setCount(rows.length);
 *   onDestroy(virtual.destroy);
 * </script>
 *
 * <div use:virtual.scroller style="overflow: auto; height: 400px">
 *   <div style="height: {$virtual.totalSize}px; position: relative">
 *     {#each $virtual.items as item (item.key)}
 *       <div
 *         use:virtual.measure
 *         data-index={item.index}
 *         style="position: absolute; top: 0; transform: translateY({item.start}px)"
 *       >
 *         {rows[item.index].label}
 *       </div>
 *     {/each}
 *   </div>
 * </div>
 */
export function createVirtualizer(options: VirtualizerOptions): VirtualStore {
  const virtualizer = createCore(options);

  // Svelte's store contract: call `run` with the current value immediately,
  // then again on every change; return an unsubscribe.
  function subscribe(run: (value: VirtualizerSnapshot) => void): () => void {
    run(virtualizer.getSnapshot());
    return virtualizer.subscribe(() => run(virtualizer.getSnapshot()));
  }

  function scroller(node: Element): { destroy(): void } {
    virtualizer.setScrollElement(node);
    return {
      destroy() {
        virtualizer.setScrollElement(null);
      },
    };
  }

  function measure(node: Element): { destroy(): void } {
    virtualizer.measureElement(node);
    return {
      destroy() {
        // Nothing to undo: the virtualizer stops watching a row as soon as it
        // leaves the rendered window, and its measured size is worth keeping.
      },
    };
  }

  return {
    subscribe,
    scroller,
    measure,
    setScrollElement: virtualizer.setScrollElement,
    setCount: (count) => {
      virtualizer.setOptions({ count });
    },
    scrollToIndex: virtualizer.scrollToIndex,
    scrollToOffset: virtualizer.scrollToOffset,
    destroy: virtualizer.destroy,
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
