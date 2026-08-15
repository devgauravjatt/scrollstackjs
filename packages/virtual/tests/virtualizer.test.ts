import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVirtualizer, type VirtualizerOptions } from '../src/index';
import { createScroller, installResizeObserver, type FakeScroller } from './helpers';

function setup(options: Partial<VirtualizerOptions> = {}, viewport = 300) {
  const scroller = createScroller({ viewport, horizontal: options.horizontal ?? false });
  const virtualizer = createVirtualizer({
    count: 100,
    estimateSize: () => 100,
    ...options,
  });
  virtualizer.setScrollElement(scroller.element);
  return { virtualizer, scroller };
}

function indexes(items: readonly { index: number }[]): number[] {
  return items.map((item) => item.index);
}

beforeEach(() => {
  installResizeObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('createVirtualizer', () => {
  it('renders only the visible window plus overscan', () => {
    const { virtualizer } = setup({ overscan: 2 });
    const { items, totalSize, startIndex, endIndex, count } = virtualizer.getSnapshot();

    expect(indexes(items)).toEqual([0, 1, 2, 3, 4]);
    expect({ startIndex, endIndex, count }).toEqual({ startIndex: 0, endIndex: 4, count: 100 });
    expect(totalSize).toBe(10_000);
  });

  it('positions every item it returns', () => {
    const { virtualizer } = setup({ overscan: 0, paddingStart: 50, gap: 10 });

    expect(virtualizer.getSnapshot().items).toEqual([
      { index: 0, key: 0, start: 50, end: 150, size: 100 },
      { index: 1, key: 1, start: 160, end: 260, size: 100 },
      { index: 2, key: 2, start: 270, end: 370, size: 100 },
    ]);
  });

  it('moves the window as the container scrolls', () => {
    const { virtualizer, scroller } = setup({ overscan: 1 });

    scroller.scrollTo(5000);

    expect(indexes(virtualizer.getSnapshot().items)).toEqual([49, 50, 51, 52, 53]);
    expect(virtualizer.getScrollOffset()).toBe(5000);
  });

  it('keeps the snapshot referentially stable while the window does not change', () => {
    const { virtualizer, scroller } = setup({ overscan: 1, isScrollingDelay: 0 });
    const listener = vi.fn();
    virtualizer.subscribe(listener);

    scroller.scrollTo(50);
    const before = virtualizer.getSnapshot();
    expect(listener).toHaveBeenCalledTimes(1);

    scroller.scrollTo(60); // a few pixels: same rows, same window
    expect(virtualizer.getSnapshot()).toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);
    // ...and yet the live offset moved. That is why it is not in the snapshot.
    expect(virtualizer.getScrollOffset()).toBe(60);

    scroller.scrollTo(400); // now the window has genuinely moved
    expect(virtualizer.getSnapshot()).not.toBe(before);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('reports scrolling and settles after the delay', () => {
    vi.useFakeTimers();
    try {
      const { virtualizer, scroller } = setup({ isScrollingDelay: 150 });

      scroller.scrollTo(20);
      expect(virtualizer.getSnapshot().isScrolling).toBe(true);

      vi.advanceTimersByTime(150);
      expect(virtualizer.getSnapshot().isScrolling).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops notifying after unsubscribe', () => {
    const { virtualizer, scroller } = setup({ isScrollingDelay: 0 });
    const listener = vi.fn();
    const unsubscribe = virtualizer.subscribe(listener);

    scroller.scrollTo(1000);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    scroller.scrollTo(2000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for an empty list', () => {
    const { virtualizer } = setup({ count: 0, paddingStart: 10, paddingEnd: 10 });
    const snapshot = virtualizer.getSnapshot();

    expect(snapshot.items).toEqual([]);
    expect(snapshot.endIndex).toBe(-1);
    expect(snapshot.totalSize).toBe(20);
  });

  it('grows with the list when a page lands', () => {
    const { virtualizer } = setup({ count: 20 });
    expect(virtualizer.getSnapshot().totalSize).toBe(2000);

    virtualizer.setOptions({ count: 40 });

    const snapshot = virtualizer.getSnapshot();
    expect(snapshot.count).toBe(40);
    expect(snapshot.totalSize).toBe(4000);
  });

  it('keeps the rest of the configuration when only the count is pushed in', () => {
    const { virtualizer } = setup({ count: 20, overscan: 0, gap: 10 });

    virtualizer.setOptions({ count: 21 });

    expect(virtualizer.getSnapshot().items[1]?.start).toBe(110);
  });

  it('follows the container when it is resized', () => {
    const { virtualizer, scroller } = setup({ overscan: 0 });
    expect(virtualizer.getSnapshot().endIndex).toBe(2);

    scroller.resize(800);

    expect(virtualizer.getSnapshot().endIndex).toBe(7);
    expect(virtualizer.getViewportSize()).toBe(800);
  });

  it('lays out along the x-axis when horizontal', () => {
    const { virtualizer, scroller } = setup({ horizontal: true, overscan: 0 }, 250);

    expect(indexes(virtualizer.getSnapshot().items)).toEqual([0, 1, 2]);

    scroller.scrollTo(1000);
    expect(virtualizer.getSnapshot().startIndex).toBe(10);
  });

  it('accounts for a list that starts part-way down the container', () => {
    const { virtualizer, scroller } = setup({ overscan: 0, scrollMargin: 400 });

    scroller.scrollTo(400);

    expect(virtualizer.getSnapshot().startIndex).toBe(0);
  });

  describe('scrolling to an index', () => {
    it('aligns to the start, end and centre', () => {
      const { virtualizer, scroller } = setup();

      virtualizer.scrollToIndex(10, { align: 'start' });
      expect(scroller.offset()).toBe(1000);

      virtualizer.scrollToIndex(10, { align: 'end' });
      expect(scroller.offset()).toBe(800);

      virtualizer.scrollToIndex(10, { align: 'center' });
      expect(scroller.offset()).toBe(900);
    });

    it('does not move for an item that is already visible', () => {
      const { virtualizer, scroller } = setup();
      scroller.scrollTo(1000);

      virtualizer.scrollToIndex(11);

      expect(scroller.offset()).toBe(1000);
    });

    it('clamps out-of-range indices instead of scrolling into the void', () => {
      const { virtualizer, scroller } = setup({ count: 10 });

      virtualizer.scrollToIndex(999, { align: 'start' });

      expect(scroller.offset()).toBe(900);
      expect(virtualizer.getOffsetForIndex(-5, 'start')).toBe(0);
    });

    it('updates the rendered window immediately for an instant scroll', () => {
      const { virtualizer } = setup({ overscan: 0 });

      virtualizer.scrollToIndex(50, { align: 'start' });

      expect(virtualizer.getSnapshot().startIndex).toBe(50);
    });
  });

  it('detaches everything on destroy', () => {
    const { virtualizer, scroller } = setup({ isScrollingDelay: 0 });
    const listener = vi.fn();
    virtualizer.subscribe(listener);

    virtualizer.destroy();
    scroller.scrollTo(5000);

    expect(listener).not.toHaveBeenCalled();
    expect(virtualizer.getSnapshot().startIndex).toBe(0);
  });

  it('rejects options it cannot work without', () => {
    expect(() => createVirtualizer({ count: 10 } as unknown as VirtualizerOptions)).toThrow(
      /estimateSize/,
    );
    expect(() =>
      createVirtualizer({ estimateSize: () => 10 } as unknown as VirtualizerOptions),
    ).toThrow(/count/);
  });
});

describe('without a scroll container', () => {
  let scroller: FakeScroller;

  beforeEach(() => {
    scroller = createScroller({ viewport: 300 });
  });

  it('renders the window the initial viewport implies', () => {
    const virtualizer = createVirtualizer({
      count: 100,
      estimateSize: () => 100,
      overscan: 0,
      initialViewport: 500,
      initialOffset: 1000,
    });

    expect(indexes(virtualizer.getSnapshot().items)).toEqual([10, 11, 12, 13, 14]);
  });

  it('attaches and detaches the container idempotently', () => {
    const virtualizer = createVirtualizer({ count: 100, estimateSize: () => 100, overscan: 0 });
    const listener = vi.fn();
    virtualizer.subscribe(listener);

    virtualizer.setScrollElement(scroller.element);
    virtualizer.setScrollElement(scroller.element); // same target: no-op
    expect(listener).toHaveBeenCalledTimes(1);

    virtualizer.setScrollElement(null);
    scroller.scrollTo(5000);
    expect(virtualizer.getScrollOffset()).toBe(0);
  });
});
