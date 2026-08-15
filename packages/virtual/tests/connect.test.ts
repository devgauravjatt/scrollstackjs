import { createInfiniteScroll, type InfiniteScroll } from '@scrollstackjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectInfiniteScroll, createVirtualizer } from '../src/index';
import { createScroller, installResizeObserver } from './helpers';

interface Page {
  readonly items: readonly number[];
  readonly cursor: number | null;
}

/** A feed of 20-item pages, and the virtual list rendering it. */
function setup({
  pages = 10,
  threshold,
  fetchPage,
}: {
  pages?: number;
  threshold?: number;
  fetchPage?: (context: { pageParam: number }) => Promise<Page>;
} = {}) {
  const scroller = createScroller({ viewport: 300 });
  const engine: InfiniteScroll<Page, number> = createInfiniteScroll<Page, number>({
    initialPageParam: 0,
    fetchPage:
      fetchPage ??
      (async ({ pageParam }) => ({
        items: Array.from({ length: 20 }, (_, index) => pageParam * 20 + index),
        cursor: pageParam + 1 < pages ? pageParam + 1 : null,
      })),
    getNextPageParam: (last) => last.cursor,
    retry: false,
  });

  const virtualizer = createVirtualizer({ count: 0, estimateSize: () => 100, overscan: 0 });
  virtualizer.setScrollElement(scroller.element);

  // What a framework binding does on every render: push the item count in.
  const sync = engine.subscribe(() => {
    virtualizer.setOptions({ count: engine.getSnapshot().pages.length * 20 });
  });

  const disconnect = connectInfiniteScroll(virtualizer, engine, { threshold });
  return {
    engine,
    virtualizer,
    scroller,
    disconnect: () => {
      disconnect();
      sync();
    },
  };
}

function loaded(engine: InfiniteScroll<Page, number>): number {
  return engine.getSnapshot().pages.length;
}

/** Lets the engine's fetch settle — it is async even when the page is not. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  installResizeObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('connectInfiniteScroll', () => {
  it('loads the first page, since a virtual list has no sentinel to trigger it', async () => {
    const { engine } = setup();

    await settle();

    expect(loaded(engine)).toBe(1);
  });

  it('loads the next page once the window comes within the threshold of the end', async () => {
    const { engine, scroller, virtualizer } = setup({ threshold: 5 });
    await settle();
    expect(loaded(engine)).toBe(1);

    scroller.scrollTo(200); // rows 2-4 of 20: nowhere near the end
    await settle();
    expect(loaded(engine)).toBe(1);

    scroller.scrollTo(1400); // rows 14-16 of 20: inside the threshold
    await settle();
    expect(loaded(engine)).toBe(2);
    expect(virtualizer.getSnapshot().count).toBe(40);
  });

  it('stops at the end of the data', async () => {
    const { engine, scroller } = setup({ pages: 2 });
    await settle();

    scroller.scrollTo(1400);
    await settle();
    scroller.scrollTo(3000);
    await settle();
    scroller.scrollTo(3700);
    await settle();

    expect(loaded(engine)).toBe(2);
    expect(engine.getSnapshot().hasNextPage).toBe(false);
  });

  it('asks for one page at a time, however many times the window moves', async () => {
    const fetchPage = vi.fn(async ({ pageParam }: { pageParam: number }) => ({
      items: Array.from({ length: 20 }, (_, index) => pageParam * 20 + index),
      cursor: pageParam + 1,
    }));
    const { scroller } = setup({ fetchPage, threshold: 5 });
    await settle();

    scroller.scrollTo(1400);
    scroller.scrollTo(1500);
    scroller.scrollTo(1600);
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(2); // the first page, and one more
  });

  it('leaves a failed load to the engine instead of retrying on every frame', async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error('offline');
    });
    const { engine, scroller } = setup({ fetchPage });
    await settle();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().isError).toBe(true);

    scroller.scrollTo(100);
    scroller.scrollTo(200);
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('picks back up after the engine is reset', async () => {
    const { engine } = setup();
    await settle();
    expect(loaded(engine)).toBe(1);

    engine.reset();
    await settle();

    expect(loaded(engine)).toBe(1);
  });

  it('stops loading once disconnected', async () => {
    const { engine, scroller, disconnect } = setup({ threshold: 5 });
    await settle();

    disconnect();
    scroller.scrollTo(1400);
    await settle();

    expect(loaded(engine)).toBe(1);
  });
});
