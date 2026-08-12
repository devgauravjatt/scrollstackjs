import { describe, expect, it } from 'vitest';

import { createInfiniteScroll } from '../src/index';

/**
 * The whole point of the single `getNextPageParam` abstraction: cursor, offset,
 * and page-number pagination are all just different derivations, not different
 * code paths. These three tests exercise the same engine three ways.
 */
describe('pagination strategies', () => {
  it('cursor-based pagination', async () => {
    interface CursorPage {
      readonly items: readonly string[];
      readonly nextCursor: string | null;
    }
    const db: Record<string, CursorPage> = {
      start: { items: ['a'], nextCursor: 'c1' },
      c1: { items: ['b'], nextCursor: 'c2' },
      c2: { items: ['c'], nextCursor: null },
    };

    const scroll = createInfiniteScroll<CursorPage, string>({
      initialPageParam: 'start',
      fetchPage: async ({ pageParam }) => db[pageParam]!,
      getNextPageParam: (last) => last.nextCursor,
    });

    await scroll.loadNextPage();
    await scroll.loadNextPage();
    await scroll.loadNextPage();

    expect(scroll.getSnapshot().pages.flatMap((p) => p.items)).toEqual(['a', 'b', 'c']);
    expect(scroll.getSnapshot().hasNextPage).toBe(false);
    expect(scroll.getSnapshot().pageParams).toEqual(['start', 'c1', 'c2']);
  });

  it('offset/limit pagination', async () => {
    const all = Array.from({ length: 25 }, (_, i) => i);
    const limit = 10;

    const scroll = createInfiniteScroll<readonly number[], number>({
      initialPageParam: 0,
      fetchPage: async ({ pageParam }) => all.slice(pageParam, pageParam + limit),
      // Next offset only if the last page was full; otherwise we've hit the end.
      getNextPageParam: (lastPage, _all, lastParam) =>
        lastPage.length === limit ? lastParam + limit : null,
    });

    await scroll.loadNextPage(); // 0..9
    await scroll.loadNextPage(); // 10..19
    await scroll.loadNextPage(); // 20..24 (length 5 -> stop)

    const flat = scroll.getSnapshot().pages.flat();
    expect(flat).toHaveLength(25);
    expect(flat[24]).toBe(24);
    expect(scroll.getSnapshot().hasNextPage).toBe(false);
  });

  it('page-number pagination', async () => {
    const totalPages = 3;

    const scroll = createInfiniteScroll<{ page: number }, number>({
      initialPageParam: 1,
      fetchPage: async ({ pageParam }) => ({ page: pageParam }),
      getNextPageParam: (_last, _all, lastParam) => (lastParam < totalPages ? lastParam + 1 : null),
    });

    await scroll.loadNextPage();
    await scroll.loadNextPage();
    await scroll.loadNextPage();

    expect(scroll.getSnapshot().pageParams).toEqual([1, 2, 3]);
    expect(scroll.getSnapshot().hasNextPage).toBe(false);
  });

  it('treats a 0 page param as valid (not "no more pages")', async () => {
    // Guards against a truthiness bug: offset 0 must be a real param.
    const scroll = createInfiniteScroll<{ v: number }, number>({
      initialPageParam: 5,
      fetchPage: async ({ pageParam }) => ({ v: pageParam }),
      getNextPageParam: (last) => (last.v > 0 ? last.v - 5 : null), // 5 -> 0 -> stop
    });

    await scroll.loadNextPage(); // param 5
    expect(scroll.getSnapshot().hasNextPage).toBe(true);
    await scroll.loadNextPage(); // param 0 (valid!)
    expect(scroll.getSnapshot().pageParams).toEqual([5, 0]);
    expect(scroll.getSnapshot().hasNextPage).toBe(false);
  });
});
