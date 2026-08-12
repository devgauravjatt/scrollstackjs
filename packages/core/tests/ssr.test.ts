// Runs in the default 'node' environment — no window, no IntersectionObserver.
import { describe, expect, it } from 'vitest';

import { createInfiniteScroll } from '../src/index';
import type { Page } from './helpers';

describe('SSR safety', () => {
  it('has no IntersectionObserver in this environment', () => {
    expect(typeof IntersectionObserver).toBe('undefined');
  });

  it('constructs and reports idle state without a DOM', () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    expect(scroll.getSnapshot().isIdle).toBe(true);
    expect(scroll.getSnapshot().pages).toEqual([]);
  });

  it('observeTarget is a no-op (does not throw) when there is no DOM', () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    // On the server, React never calls the ref with a node — but even if something
    // does, we must not crash. It simply does nothing.
    expect(() => scroll.observeTarget(null as unknown as Element)).not.toThrow();
    expect(scroll.getSnapshot().isIdle).toBe(true);
  });

  it('can still load pages programmatically on the server', async () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async ({ pageParam }) => ({ items: [pageParam], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    await scroll.loadNextPage();
    expect(scroll.getSnapshot().pages).toHaveLength(1);
  });
});
