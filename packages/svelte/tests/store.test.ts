import { get } from 'svelte/store';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInfiniteScroll } from '../src/index';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  private readonly cb: IntersectionObserverCallback;
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    MockIntersectionObserver.instances.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  enter(el: Element): void {
    this.cb(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

interface Item {
  readonly id: number;
}

function make() {
  return createInfiniteScroll<Item, number>({
    initialPageParam: 0,
    fetchPage: async ({ pageParam }) => ({ id: pageParam }),
    getNextPageParam: (last) => (last.id < 2 ? last.id + 1 : null),
  });
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createInfiniteScroll (svelte)', () => {
  it('satisfies the Svelte store contract (immediate value + updates)', async () => {
    const scroll = make();

    const seen: number[] = [];
    const unsubscribe = scroll.subscribe((snap) => seen.push(snap.pages.length));
    expect(seen).toEqual([0]); // store must emit current value immediately

    await scroll.loadNextPage();
    expect(seen[seen.length - 1]).toBe(1);

    unsubscribe();
  });

  it('works with svelte/store get()', async () => {
    const scroll = make();
    expect(get(scroll).isIdle).toBe(true);
    await scroll.loadNextPage();
    expect(get(scroll).pages).toHaveLength(1);
  });

  it('the target action observes and loads on intersect', async () => {
    const scroll = make();
    const el = document.createElement('div');

    const action = scroll.target(el);
    const io = MockIntersectionObserver.instances[0]!;

    io.enter(el);
    await vi.waitFor(() => expect(get(scroll).pages).toHaveLength(1));

    action.destroy();
    expect(io.disconnected).toBe(true);
  });

  it('exposes controls and the engine', async () => {
    const scroll = make();
    await scroll.loadNextPage();
    expect(get(scroll).pages).toHaveLength(1);

    scroll.reset();
    expect(get(scroll).isIdle).toBe(true);
    expect(scroll.engine).toBeDefined();
  });
});
