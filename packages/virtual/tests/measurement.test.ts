import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVirtualizer, type VirtualizerOptions } from '../src/index';
import {
  createRow,
  createScroller,
  FakeResizeObserver,
  installResizeObserver,
  rect,
  setRowSize,
} from './helpers';

function setup(options: Partial<VirtualizerOptions> = {}, viewport = 300) {
  const scroller = createScroller({ viewport });
  const virtualizer = createVirtualizer({
    count: 100,
    estimateSize: () => 100,
    overscan: 0,
    ...options,
  });
  virtualizer.setScrollElement(scroller.element);
  return { virtualizer, scroller };
}

beforeEach(() => {
  installResizeObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('measuring rendered rows', () => {
  it('replaces the estimate and re-stacks everything below', () => {
    const { virtualizer } = setup();

    virtualizer.measureElement(createRow(0, 250));

    const { items, totalSize } = virtualizer.getSnapshot();
    expect(items[0]?.size).toBe(250);
    expect(items[1]?.start).toBe(250);
    expect(totalSize).toBe(250 + 99 * 100);
  });

  it('leaves the rows above the measured one where they were', () => {
    const { virtualizer } = setup();
    const first = virtualizer.getSnapshot().items[0];

    virtualizer.measureElement(createRow(2, 400));

    expect(virtualizer.getSnapshot().items[0]).toBe(first);
  });

  it('takes the index from an explicit argument when there is no attribute', () => {
    const { virtualizer } = setup();
    const row = document.createElement('div');
    setRowSize(row, 175);

    virtualizer.measureElement(row, 0);

    expect(virtualizer.getSnapshot().items[0]?.size).toBe(175);
  });

  it('says so when it cannot tell which row an element is', () => {
    const { virtualizer } = setup();
    const row = document.createElement('div');
    setRowSize(row, 175);

    expect(() => virtualizer.measureElement(row)).toThrow(/data-index/);
  });

  it('ignores a null element, so a ref cleanup can call it directly', () => {
    const { virtualizer } = setup();
    expect(() => virtualizer.measureElement(null)).not.toThrow();
  });

  it('keeps the estimate for a row that has no layout box yet', () => {
    const { virtualizer } = setup();
    const row = createRow(0, 0);
    row.getBoundingClientRect = () => rect(0, 0);

    virtualizer.measureElement(row);

    // Believing a `display: none` row is 0px tall would collapse it, move the
    // window onto rows that are also not laid out, and never settle.
    expect(virtualizer.getSnapshot().items[0]?.size).toBe(100);
    expect(virtualizer.getSnapshot().totalSize).toBe(10_000);
  });

  it('measures a laid-out row that really is empty', () => {
    const { virtualizer } = setup();
    const row = createRow(0, 0);
    row.getBoundingClientRect = () => rect(320, 0); // full width, no height

    virtualizer.measureElement(row);

    // It takes up no space, so the list is 100px shorter and the row is not in
    // the window — there is nothing of it to see.
    expect(virtualizer.getSnapshot().totalSize).toBe(9900);
    expect(virtualizer.getSnapshot().startIndex).toBe(1);
  });

  it('ignores rows outside the list', () => {
    const { virtualizer } = setup({ count: 5 });

    virtualizer.measureElement(createRow(9, 400));

    expect(virtualizer.getSnapshot().totalSize).toBe(500);
  });

  it('re-measures when a rendered row changes size later', () => {
    const { virtualizer } = setup();
    const row = createRow(1, 100);

    virtualizer.measureElement(row);
    expect(virtualizer.getSnapshot().totalSize).toBe(10_000);

    setRowSize(row, 300);
    FakeResizeObserver.emit(row);

    expect(virtualizer.getSnapshot().totalSize).toBe(10_200);
  });

  it('publishes once for a batch of resize entries', () => {
    const { virtualizer } = setup();
    const rows = [createRow(0, 100), createRow(1, 100)];
    for (const row of rows) virtualizer.measureElement(row);

    const listener = vi.fn();
    virtualizer.subscribe(listener);
    for (const row of rows) setRowSize(row, 200);
    FakeResizeObserver.emit(...rows);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(virtualizer.getSnapshot().totalSize).toBe(10_200);
  });

  it('stops watching rows once they leave the window', () => {
    const { virtualizer, scroller } = setup();
    const row = createRow(0, 100);
    virtualizer.measureElement(row);
    expect(FakeResizeObserver.watches(row)).toBe(true);

    scroller.scrollTo(5000);

    expect(FakeResizeObserver.watches(row)).toBe(false);
  });

  it('drops every measurement on reset', () => {
    const { virtualizer } = setup();
    virtualizer.measureElement(createRow(0, 250));
    expect(virtualizer.getSnapshot().totalSize).toBe(10_150);

    virtualizer.resetMeasurements();

    expect(virtualizer.getSnapshot().totalSize).toBe(10_000);
  });

  it('keeps a measured size with its item when rows are prepended', () => {
    const ids = Array.from({ length: 100 }, (_, index) => `id-${index}`);
    const { virtualizer } = setup({
      count: ids.length,
      getItemKey: (index) => ids[index] ?? index,
    });

    virtualizer.measureElement(createRow(0, 250));
    expect(virtualizer.getSnapshot().items[0]?.size).toBe(250);

    // A newer item arrives at the head: every index shifts by one.
    ids.unshift('id-new');
    virtualizer.setOptions({ count: ids.length });

    const items = virtualizer.getSnapshot().items;
    expect(items[0]?.size).toBe(100); // the new row is still an estimate
    expect(items[1]?.size).toBe(250); // ...and the measured one moved down with its key
  });
});

describe('when a row above the viewport turns out to be the wrong size', () => {
  it('compensates the scroll offset so the visible rows stay put', () => {
    const { virtualizer, scroller } = setup();
    scroller.scrollTo(5000);
    const before = virtualizer.getSnapshot().startIndex;

    // Row 3 is far above the viewport and is 50px taller than estimated.
    virtualizer.measureElement(createRow(3, 150));

    expect(scroller.offset()).toBe(5050);
    expect(virtualizer.getScrollOffset()).toBe(5050);
    expect(virtualizer.getSnapshot().startIndex).toBe(before);
  });

  it('leaves the offset alone for a row inside the viewport', () => {
    const { virtualizer, scroller } = setup();
    scroller.scrollTo(5000);

    virtualizer.measureElement(createRow(51, 150));

    expect(scroller.offset()).toBe(5000);
  });

  it('can be turned off', () => {
    const { virtualizer, scroller } = setup({ adjustScrollOnMeasure: false });
    scroller.scrollTo(5000);

    virtualizer.measureElement(createRow(3, 150));

    expect(scroller.offset()).toBe(5000);
  });
});
