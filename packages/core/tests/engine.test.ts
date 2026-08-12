import { describe, expect, it, vi } from 'vitest';

import { createInfiniteScroll, ScrollStackError } from '../src/index';
import type { Page } from './helpers';

describe('createInfiniteScroll — basics', () => {
  it('starts idle with an assumed next page', () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    const snap = scroll.getSnapshot();
    expect(snap.isIdle).toBe(true);
    expect(snap.pages).toEqual([]);
    expect(snap.hasNextPage).toBe(true);
    expect(snap.isFetching).toBe(false);
  });

  it('loads the first page and moves to success', async () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async ({ pageParam }) => ({ items: [pageParam], cursor: pageParam + 1 }),
      getNextPageParam: (last) => last.cursor,
    });

    await scroll.loadNextPage();

    const snap = scroll.getSnapshot();
    expect(snap.isSuccess).toBe(true);
    expect(snap.pages).toHaveLength(1);
    expect(snap.pages[0]).toEqual({ items: [0], cursor: 1 });
    expect(snap.hasNextPage).toBe(true);
    expect(snap.isFetching).toBe(false);
  });

  it('paginates across multiple pages then stops when exhausted', async () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      // Three pages: params 0, 1, 2. Page 2 has cursor null -> no more.
      fetchPage: async ({ pageParam }) => ({
        items: [pageParam],
        cursor: pageParam < 2 ? pageParam + 1 : null,
      }),
      getNextPageParam: (last) => last.cursor,
    });

    await scroll.loadNextPage();
    await scroll.loadNextPage();
    await scroll.loadNextPage();

    expect(scroll.getSnapshot().pages).toHaveLength(3);
    expect(scroll.getSnapshot().hasNextPage).toBe(false);

    // Further calls are no-ops once exhausted.
    await scroll.loadNextPage();
    expect(scroll.getSnapshot().pages).toHaveLength(3);
  });

  it('notifies subscribers on state change and stops after unsubscribe', async () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    const listener = vi.fn();
    const unsubscribe = scroll.subscribe(listener);

    await scroll.loadNextPage();
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    scroll.reset();
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns a stable snapshot reference until state changes', async () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    const a = scroll.getSnapshot();
    const b = scroll.getSnapshot();
    expect(a).toBe(b); // same reference — critical for useSyncExternalStore

    await scroll.loadNextPage();
    const c = scroll.getSnapshot();
    expect(c).not.toBe(a); // new reference after a real change
  });

  it('throws a clear error when required options are missing', () => {
    expect(() =>
      // @ts-expect-error — deliberately omitting fetchPage
      createInfiniteScroll({ initialPageParam: 0, getNextPageParam: () => null }),
    ).toThrow(ScrollStackError);
  });
});
