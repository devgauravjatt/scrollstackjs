// @vitest-environment node

/**
 * Invariant 7: nothing in this package may touch the DOM at module scope, and the
 * headless half has to work on a server. `mount()` is the only DOM entry point and
 * it no-ops when there is nothing to mount into.
 */

import { createInfiniteScroll } from '@scrollstackjs/core';
import { describe, expect, it } from 'vitest';

import { createDevtools, createDevtoolsStore } from '../src/index';

interface Page {
  readonly items: readonly number[];
  readonly next: number | null;
}

function makeEngine(): ReturnType<typeof createInfiniteScroll<Page, number>> {
  return createInfiniteScroll<Page, number>({
    initialPageParam: 0,
    retry: false,
    fetchPage: ({ pageParam }) => ({ items: [pageParam], next: null }),
    getNextPageParam: (last) => last.next,
  });
}

describe('server rendering', () => {
  it('has no DOM in this environment', () => {
    expect(typeof document).toBe('undefined');
  });

  it('runs the store without a DOM', async () => {
    const engine = makeEngine();
    const store = createDevtoolsStore(engine);

    await engine.loadNextPage();
    const state = store.getSnapshot();

    expect(state.phase).toBe('complete');
    expect(state.events.map((event) => event.type)).toEqual(['success', 'loadStart']);
  });

  it('no-ops on mount() instead of throwing', () => {
    const devtools = createDevtools(makeEngine());

    expect(() => devtools.mount()).not.toThrow();
    expect(() => devtools.open()).not.toThrow();
    expect(() => devtools.unmount()).not.toThrow();
    expect(() => devtools.destroy()).not.toThrow();
  });
});
