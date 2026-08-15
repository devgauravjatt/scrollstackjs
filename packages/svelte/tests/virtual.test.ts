// @vitest-environment jsdom
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVirtualizer } from '../src/virtual';

/** jsdom has no layout: give the document a 300px viewport and one scroll offset. */
let offset = 0;

function stubLayout(): void {
  offset = 0;
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get: () => 300,
  });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get: () => offset,
    set: (value: number) => {
      offset = value;
    },
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
}

function scrollTo(element: Element, next: number): void {
  offset = next;
  element.dispatchEvent(new Event('scroll'));
}

function make(count = 1000) {
  const virtual = createVirtualizer({
    count,
    estimateSize: () => 100,
    overscan: 0,
    isScrollingDelay: 0,
  });
  const container = document.createElement('div');
  document.body.append(container);
  const action = virtual.scroller(container);
  return { virtual, container, action };
}

beforeEach(() => {
  stubLayout();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('createVirtualizer (svelte)', () => {
  it('is a store whose value is the snapshot', () => {
    const { virtual } = make();

    const snapshot = get(virtual);
    expect(snapshot.items.map((item) => item.index)).toEqual([0, 1, 2]);
    expect(snapshot.totalSize).toBe(100_000);
  });

  it('calls subscribers immediately and on every change', () => {
    const { virtual, container } = make();
    const seen: number[] = [];

    const unsubscribe = virtual.subscribe((snapshot) => seen.push(snapshot.startIndex));
    expect(seen).toEqual([0]);

    scrollTo(container, 5000);
    expect(seen).toEqual([0, 50]);

    unsubscribe();
    scrollTo(container, 8000);
    expect(seen).toEqual([0, 50]);
  });

  it('takes a new count as pages land', () => {
    const { virtual } = make(10);
    expect(get(virtual).totalSize).toBe(1000);

    virtual.setCount(30);

    expect(get(virtual).totalSize).toBe(3000);
  });

  it('detaches the container when the action is destroyed', () => {
    const { virtual, container, action } = make();

    action.destroy();
    scrollTo(container, 5000);

    expect(get(virtual).startIndex).toBe(0);
  });

  it('measures a row through its action', () => {
    const { virtual } = make();
    const row = document.createElement('div');
    row.setAttribute('data-index', '0');
    row.getBoundingClientRect = () =>
      ({ width: 0, height: 250, top: 0, left: 0, right: 0, bottom: 250, x: 0, y: 0 }) as DOMRect;

    virtual.measure(row);

    expect(get(virtual).items[0]?.size).toBe(250);
  });

  it('stops updating after destroy', () => {
    const { virtual, container } = make();

    virtual.destroy();
    scrollTo(container, 5000);

    expect(get(virtual).startIndex).toBe(0);
  });
});
