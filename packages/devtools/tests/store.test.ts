import { createInfiniteScroll, type InfiniteScroll } from '@scrollstackjs/core';
import { describe, expect, it } from 'vitest';

import { createDevtoolsStore, derivePhase } from '../src/index';

interface Page {
  readonly items: readonly number[];
  readonly next: number | null;
}

/** Two pages, then the end. */
function makeEngine(
  options: { failAt?: number; retry?: boolean } = {},
): InfiniteScroll<Page, number> {
  const { failAt, retry = false } = options;
  return createInfiniteScroll<Page, number>({
    initialPageParam: 0,
    retry,
    fetchPage: ({ pageParam }) => {
      if (failAt === pageParam) throw new Error(`boom at ${pageParam}`);
      return { items: [pageParam], next: pageParam >= 1 ? null : pageParam + 1 };
    },
    getNextPageParam: (last) => last.next,
  });
}

describe('createDevtoolsStore', () => {
  it('starts from the engine snapshot with an empty timeline', () => {
    const store = createDevtoolsStore(makeEngine());
    const state = store.getSnapshot();

    expect(state.events).toEqual([]);
    expect(state.phase).toBe('idle');
    expect(state.snapshot.pages).toEqual([]);
  });

  it('returns a stable reference until something changes', async () => {
    const engine = makeEngine();
    const store = createDevtoolsStore(engine);
    const first = store.getSnapshot();

    expect(store.getSnapshot()).toBe(first);
    await engine.loadNextPage();
    expect(store.getSnapshot()).not.toBe(first);
  });

  it('records loadStart → success, newest first, with a duration and page count', async () => {
    const engine = makeEngine();
    const store = createDevtoolsStore(engine);

    await engine.loadNextPage();
    const { events } = store.getSnapshot();

    expect(events.map((event) => event.type)).toEqual(['success', 'loadStart']);
    const [success, start] = events;
    expect(start?.pageParam).toBe(0);
    expect(success?.pageParam).toBe(0);
    expect(success?.pageCount).toBe(1);
    expect(success?.durationMs).toBeGreaterThanOrEqual(0);
    expect(start?.durationMs).toBeNull();
    // Ids increase with time; the newest row is first.
    expect(success!.id).toBeGreaterThan(start!.id);
  });

  it('records an error with its message and failure count', async () => {
    const engine = makeEngine({ failAt: 0 });
    const store = createDevtoolsStore(engine);

    await engine.loadNextPage();
    const failure = store.getSnapshot().events.find((event) => event.type === 'error');

    expect(failure?.message).toBe('boom at 0');
    expect(failure?.failureCount).toBe(1);
    expect(failure?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('separates a first-load failure from a load-more failure (ADR-003)', async () => {
    const firstLoad = createDevtoolsStore(makeEngine({ failAt: 0 }));
    await firstLoad.engine.loadNextPage();
    expect(firstLoad.getSnapshot().phase).toBe('firstLoadFailed');
    expect(firstLoad.getSnapshot().snapshot.pages).toHaveLength(0);

    const loadMore = createDevtoolsStore(makeEngine({ failAt: 1 }));
    await loadMore.engine.loadNextPage(); // page 0 succeeds
    await loadMore.engine.loadNextPage(); // page 1 fails
    const state = loadMore.getSnapshot();

    expect(state.phase).toBe('loadMoreFailed');
    expect(state.snapshot.status).toBe('success'); // data survives
    expect(state.snapshot.pages).toHaveLength(1);
  });

  it('reports completion once the last page is in', async () => {
    const engine = makeEngine();
    const store = createDevtoolsStore(engine);

    await engine.loadNextPage();
    expect(store.getSnapshot().phase).toBe('ready');
    await engine.loadNextPage();
    expect(store.getSnapshot().phase).toBe('complete');
    expect(store.getSnapshot().snapshot.hasNextPage).toBe(false);
  });

  it('caps the timeline at maxEvents, dropping the oldest', async () => {
    const engine = makeEngine();
    const store = createDevtoolsStore(engine, { maxEvents: 2 });

    await engine.loadNextPage();
    await engine.loadNextPage();
    const { events } = store.getSnapshot();

    expect(events).toHaveLength(2);
    // The last thing that happened was page 1 succeeding.
    expect(events[0]?.type).toBe('success');
    expect(events[0]?.pageParam).toBe(1);
  });

  it('logs a reset row and clears the timeline on demand', async () => {
    const engine = makeEngine();
    const store = createDevtoolsStore(engine);

    await engine.loadNextPage();
    engine.reset();
    expect(store.getSnapshot().events[0]?.type).toBe('reset');
    expect(store.getSnapshot().phase).toBe('idle');

    store.clearEvents();
    expect(store.getSnapshot().events).toEqual([]);
  });

  it('notifies subscribers and stops after destroy()', async () => {
    const engine = makeEngine();
    const store = createDevtoolsStore(engine);
    let calls = 0;
    store.subscribe(() => {
      calls++;
    });

    await engine.loadNextPage();
    expect(calls).toBeGreaterThan(0);

    const seen = calls;
    store.destroy();
    await engine.loadNextPage();

    expect(calls).toBe(seen);
    // The engine itself keeps working — devtools is read-only.
    expect(engine.getSnapshot().pages).toHaveLength(2);
  });

  it('unsubscribes from the engine on destroy()', async () => {
    const engine = makeEngine();
    const store = createDevtoolsStore(engine);
    store.destroy();

    const before = store.getSnapshot();
    await engine.loadNextPage();
    expect(store.getSnapshot()).toBe(before);
  });
});

describe('derivePhase', () => {
  it('names the fetching-next case while data is already on screen', async () => {
    const engine = makeEngine();
    await engine.loadNextPage();
    const snapshot = engine.getSnapshot();

    expect(derivePhase({ ...snapshot, isFetchingNextPage: true, isFetching: true })).toBe(
      'fetchingNext',
    );
  });
});
