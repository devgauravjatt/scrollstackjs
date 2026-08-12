import { describe, expect, it, vi } from 'vitest';

import { createInfiniteScroll } from '../src/index';
import type { InfiniteScroll } from '../src/index';
import type { Page } from './helpers';

describe('lifecycle: callbacks, events, plugins', () => {
  it('fires callbacks and emits events in order on a successful load', async () => {
    const onLoadStart = vi.fn();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const order: string[] = [];

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
      retry: 0,
      onLoadStart,
      onSuccess,
      onError,
    });

    scroll.on('loadStart', () => order.push('loadStart'));
    scroll.on('success', () => order.push('success'));

    await scroll.loadNextPage();

    expect(onLoadStart).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(order).toEqual(['loadStart', 'success']);
  });

  it('fires onError and emits error when a load fails terminally', async () => {
    const onError = vi.fn();
    let errored = false;

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => {
        throw new Error('nope');
      },
      getNextPageParam: (last) => last.cursor,
      retry: 0,
      onError,
    });

    scroll.on('error', () => {
      errored = true;
    });

    await scroll.loadNextPage();
    expect(onError).toHaveBeenCalledOnce();
    expect(errored).toBe(true);
  });

  it('emits reset', () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    const onReset = vi.fn();
    scroll.on('reset', onReset);
    scroll.reset();
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('runs a plugin at construction and its cleanup on destroy', () => {
    const cleanup = vi.fn();
    let received: InfiniteScroll<Page, number> | undefined;

    const plugin = vi.fn((instance: InfiniteScroll<Page, number>) => {
      received = instance;
      return cleanup;
    });

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
      plugins: [plugin],
    });

    expect(plugin).toHaveBeenCalledOnce();
    expect(received).toBe(scroll);
    expect(cleanup).not.toHaveBeenCalled();

    scroll.destroy();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('lets a plugin observe events (e.g. an analytics plugin)', async () => {
    const seen: string[] = [];
    const analytics = (instance: InfiniteScroll<Page, number>) => {
      const offStart = instance.on('loadStart', () => seen.push('start'));
      const offSuccess = instance.on('success', () => seen.push('success'));
      return () => {
        offStart();
        offSuccess();
      };
    };

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
      plugins: [analytics],
    });

    await scroll.loadNextPage();
    expect(seen).toEqual(['start', 'success']);
  });
});
