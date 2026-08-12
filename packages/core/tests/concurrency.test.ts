import { describe, expect, it, vi } from 'vitest';

import { createInfiniteScroll } from '../src/index';
import { deferred, type Page } from './helpers';

describe('concurrency safety', () => {
  it('dedupes concurrent loadNextPage calls', async () => {
    const gate = deferred<Page>();
    const fetchPage = vi.fn(() => gate.promise);

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.cursor,
      retry: 0,
    });

    const a = scroll.loadNextPage();
    const b = scroll.loadNextPage(); // ignored: a fetch is already in flight
    const c = scroll.loadNextPage(); // ignored

    expect(fetchPage).toHaveBeenCalledTimes(1);

    gate.resolve({ items: [1], cursor: null });
    await Promise.all([a, b, c]);

    expect(scroll.getSnapshot().pages).toHaveLength(1);
  });

  it('ignores an in-flight result that resolves after reset()', async () => {
    const gate = deferred<Page>();
    const fetchPage = vi.fn(() => gate.promise);

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.cursor,
      retry: 0,
    });

    const inflight = scroll.loadNextPage();
    scroll.reset(); // supersede the in-flight fetch

    gate.resolve({ items: [999], cursor: 1 }); // resolves late — must be discarded
    await inflight;

    expect(scroll.getSnapshot().pages).toHaveLength(0);
    expect(scroll.getSnapshot().isIdle).toBe(true);
  });

  it('ignores an in-flight result that resolves after destroy()', async () => {
    const gate = deferred<Page>();
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: () => gate.promise,
      getNextPageParam: (last) => last.cursor,
      retry: 0,
    });

    const inflight = scroll.loadNextPage();
    scroll.destroy();

    gate.resolve({ items: [1], cursor: null });
    await inflight;

    // No throw, no state corruption; destroyed engine stays at its last snapshot.
    expect(scroll.getSnapshot().pages).toHaveLength(0);
  });

  it('a fresh fetch after reset supersedes the stale one', async () => {
    const first = deferred<Page>();
    const second = deferred<Page>();
    const calls: Array<'first' | 'second'> = [];
    let n = 0;

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: () => {
        n += 1;
        if (n === 1) {
          calls.push('first');
          return first.promise;
        }
        calls.push('second');
        return second.promise;
      },
      getNextPageParam: (last) => last.cursor,
      retry: 0,
    });

    const a = scroll.loadNextPage();
    scroll.reset();
    const b = scroll.loadNextPage();

    // The stale one resolves first but must be ignored; the fresh one wins.
    first.resolve({ items: [111], cursor: null });
    second.resolve({ items: [222], cursor: null });
    await Promise.all([a, b]);

    expect(calls).toEqual(['first', 'second']);
    expect(scroll.getSnapshot().pages).toEqual([{ items: [222], cursor: null }]);
  });
});
