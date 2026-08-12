// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInfiniteScroll } from '../src/index';
import type { Page } from './helpers';

/** A controllable IntersectionObserver stand-in (jsdom doesn't implement one). */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  private readonly callback: IntersectionObserverCallback;
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.observed.clear();
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Simulate the target scrolling into view. */
  enter(el: Element): void {
    this.callback(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('observer integration', () => {
  it('loads the next page when the observed target intersects', async () => {
    const fetchPage = vi.fn(async ({ pageParam }: { pageParam: number }) => ({
      items: [pageParam],
      cursor: null,
    }));

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.cursor,
    });

    const sentinel = document.createElement('div');
    scroll.observeTarget(sentinel);

    expect(fetchPage).not.toHaveBeenCalled(); // nothing until it intersects

    const io = MockIntersectionObserver.instances[0]!;
    io.enter(sentinel);
    await vi.waitFor(() => expect(scroll.getSnapshot().pages).toHaveLength(1));

    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it('does not auto-load on intersect when autoLoad is false', () => {
    const fetchPage = vi.fn(async () => ({ items: [1], cursor: null }));
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.cursor,
      autoLoad: false,
    });

    const sentinel = document.createElement('div');
    scroll.observeTarget(sentinel);
    MockIntersectionObserver.instances[0]!.enter(sentinel);

    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('destroyObserver disconnects the underlying observer', () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    scroll.observeTarget(document.createElement('div'));
    const io = MockIntersectionObserver.instances[0]!;
    expect(io.disconnected).toBe(false);

    scroll.destroyObserver();
    expect(io.disconnected).toBe(true);
  });

  it('re-observing a new target disconnects the previous observer', () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    scroll.observeTarget(document.createElement('div'));
    scroll.observeTarget(document.createElement('div'));

    const [first, second] = MockIntersectionObserver.instances;
    expect(first!.disconnected).toBe(true);
    expect(second!.disconnected).toBe(false);
  });

  it('throws a helpful error when observing a non-element', () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: async () => ({ items: [1], cursor: null }),
      getNextPageParam: (last) => last.cursor,
    });

    expect(() => scroll.observeTarget(null as unknown as Element)).toThrow(/expected an Element/);
  });
});
