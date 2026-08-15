import { describe, expect, it } from 'vitest';

import {
  computeRange,
  findFirstVisible,
  measure,
  offsetForIndex,
  totalSize,
  type LayoutSpec,
} from '../src/index';

function spec(overrides: Partial<LayoutSpec> = {}): LayoutSpec {
  return {
    count: 10,
    paddingStart: 0,
    paddingEnd: 0,
    gap: 0,
    getKey: (index) => index,
    getSize: () => 100,
    ...overrides,
  };
}

describe('measure', () => {
  it('stacks items head to tail', () => {
    const items = measure([], 0, spec({ count: 3 }));

    expect(items).toEqual([
      { index: 0, key: 0, start: 0, end: 100, size: 100 },
      { index: 1, key: 1, start: 100, end: 200, size: 100 },
      { index: 2, key: 2, start: 200, end: 300, size: 100 },
    ]);
  });

  it('applies padding at the start and gaps between items only', () => {
    const items = measure([], 0, spec({ count: 3, paddingStart: 20, gap: 10 }));

    expect(items.map((item) => item.start)).toEqual([20, 130, 240]);
    // Two items, two gaps — but the trailing gap is not part of the list.
    expect(totalSize(items, spec({ count: 3, paddingStart: 20, gap: 10 }))).toBe(340);
  });

  it('reuses the untouched prefix by reference', () => {
    const first = measure([], 0, spec());
    const second = measure(first, 4, spec());

    for (let index = 0; index < 4; index++) {
      expect(second[index]).toBe(first[index]);
    }
    expect(second[4]).not.toBe(first[4]);
    expect(second[4]).toEqual(first[4]);
  });

  it('re-stacks the suffix after a size change', () => {
    const initial = measure([], 0, spec({ count: 4 }));
    const sizes = new Map([[1, 250]]);
    const grown = measure(initial, 1, spec({ count: 4, getSize: (i) => sizes.get(i) ?? 100 }));

    expect(grown.map((item) => item.start)).toEqual([0, 100, 350, 450]);
  });

  it('truncates when the count shrinks', () => {
    const initial = measure([], 0, spec({ count: 10 }));
    const shrunk = measure(initial, 10, spec({ count: 3 }));

    expect(shrunk).toHaveLength(3);
    expect(shrunk[0]).toBe(initial[0]);
  });

  it('lays out an empty list as nothing but padding', () => {
    const empty = spec({ count: 0, paddingStart: 15, paddingEnd: 25 });

    expect(measure([], 0, empty)).toEqual([]);
    expect(totalSize([], empty)).toBe(40);
  });
});

describe('findFirstVisible', () => {
  const items = measure([], 0, spec({ count: 500 }));

  it('agrees with a linear scan at every boundary', () => {
    for (const offset of [0, 1, 99, 100, 101, 12_345, 49_899, 49_900, 999_999]) {
      const linear = items.findIndex((item) => item.end > offset);
      expect(findFirstVisible(items, offset)).toBe(linear === -1 ? items.length - 1 : linear);
    }
  });

  it('returns 0 for an empty list', () => {
    expect(findFirstVisible([], 500)).toBe(0);
  });
});

describe('computeRange', () => {
  const items = measure([], 0, spec({ count: 100 }));

  it('covers the viewport plus overscan on both sides', () => {
    // Offset 1000 shows items 10-12 (300px viewport, 100px rows).
    expect(computeRange(items, 1000, 300, 2)).toEqual({ startIndex: 8, endIndex: 14 });
  });

  it('clamps at both ends of the list', () => {
    expect(computeRange(items, 0, 300, 5)).toEqual({ startIndex: 0, endIndex: 7 });
    expect(computeRange(items, 9700, 300, 5)).toEqual({ startIndex: 92, endIndex: 99 });
  });

  it('handles a list that starts below the current scroll position', () => {
    expect(computeRange(items, -250, 300, 0)).toEqual({ startIndex: 0, endIndex: 0 });
  });

  it('reports an empty range for an empty list', () => {
    expect(computeRange([], 0, 300, 3)).toEqual({ startIndex: 0, endIndex: -1 });
  });
});

describe('offsetForIndex', () => {
  const items = measure([], 0, spec({ count: 100 }));

  it('aligns to the start, end and centre of the viewport', () => {
    expect(offsetForIndex(items, 10, 'start', 0, 300, 0)).toBe(1000);
    expect(offsetForIndex(items, 10, 'end', 0, 300, 0)).toBe(800);
    expect(offsetForIndex(items, 10, 'center', 0, 300, 0)).toBe(900);
  });

  it('leaves an already visible item alone under `auto`', () => {
    expect(offsetForIndex(items, 11, 'auto', 1000, 300, 0)).toBe(1000);
  });

  it('scrolls the shortest distance under `auto`', () => {
    expect(offsetForIndex(items, 5, 'auto', 1000, 300, 0)).toBe(500); // above -> align start
    expect(offsetForIndex(items, 20, 'auto', 1000, 300, 0)).toBe(1800); // below -> align end
  });

  it('offsets by the list position within the scroll container', () => {
    expect(offsetForIndex(items, 10, 'start', 0, 300, 400)).toBe(1400);
  });

  it('returns the current offset for an index that does not exist', () => {
    expect(offsetForIndex(items, 900, 'start', 42, 300, 0)).toBe(42);
  });
});
