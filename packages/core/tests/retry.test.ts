import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInfiniteScroll } from '../src/index';
import type { Page } from './helpers';

afterEach(() => {
  vi.useRealTimers();
});

describe('retry', () => {
  it('automatically retries a failing fetch, then succeeds', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const fetchPage = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('network');
      return { items: [attempts], cursor: null };
    });

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.cursor,
      retry: 3,
      retryDelay: 10,
    });

    scroll.loadNextPage();
    // Drive the initial attempt + scheduled retries and flush their microtasks.
    await vi.advanceTimersByTimeAsync(100);

    expect(attempts).toBe(3);
    expect(scroll.getSnapshot().isSuccess).toBe(true);
    expect(scroll.getSnapshot().pages).toHaveLength(1);
    expect(scroll.getSnapshot().failureCount).toBe(0);
  });

  it('gives up after exhausting retries and surfaces the error', async () => {
    vi.useFakeTimers();
    const fetchPage = vi.fn(async () => {
      throw new Error('always down');
    });

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.cursor,
      retry: 2,
      retryDelay: 10,
    });

    scroll.loadNextPage();
    await vi.advanceTimersByTimeAsync(100);

    const snap = scroll.getSnapshot();
    expect(snap.isError).toBe(true);
    expect(snap.error).toBeInstanceOf(Error);
    expect(fetchPage).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(snap.failureCount).toBe(3);
  });

  it('recovers via manual retry() after a terminal error', async () => {
    let down = true;
    const fetchPage = vi.fn(async () => {
      if (down) throw new Error('boom');
      return { items: [1], cursor: null };
    });

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.cursor,
      retry: 0, // no auto-retry — go straight to error
    });

    await scroll.loadNextPage();
    expect(scroll.getSnapshot().isError).toBe(true);

    down = false;
    await scroll.retry();

    const snap = scroll.getSnapshot();
    expect(snap.isSuccess).toBe(true);
    expect(snap.pages).toHaveLength(1);
    expect(snap.error).toBeNull();
    expect(snap.failureCount).toBe(0);
  });

  it('keeps loaded pages and success status when loading MORE fails', async () => {
    let call = 0;
    const fetchPage = vi.fn(async () => {
      call += 1;
      if (call === 1) return { items: [1], cursor: 1 };
      throw new Error('load-more failed');
    });

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.cursor,
      retry: 0,
    });

    await scroll.loadNextPage(); // page 1 ok
    expect(scroll.getSnapshot().pages).toHaveLength(1);

    await scroll.loadNextPage(); // page 2 fails

    const snap = scroll.getSnapshot();
    expect(snap.pages).toHaveLength(1); // existing data retained
    expect(snap.isSuccess).toBe(true); // list still renders
    expect(snap.isError).toBe(false); // not a first-load error
    expect(snap.error).toBeInstanceOf(Error); // but the failure is surfaced for a retry UI
    expect(snap.hasNextPage).toBe(true);
  });
});
