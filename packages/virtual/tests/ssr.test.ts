// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createVirtualizer } from '../src/index';

/**
 * Invariant 7: everything runs with no DOM. On the server there is no scroll
 * container, no `ResizeObserver` and no element to measure — the virtualizer has to
 * produce a sensible first render anyway, and the client has to be able to take over
 * from it without a hydration mismatch.
 */
describe('server rendering', () => {
  it('constructs and renders without a DOM', () => {
    expect(typeof window).toBe('undefined');

    const virtualizer = createVirtualizer({
      count: 1000,
      estimateSize: () => 80,
      overscan: 0,
      initialViewport: 800,
    });
    const { items, totalSize } = virtualizer.getSnapshot();

    expect(items.map((item) => item.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(totalSize).toBe(80_000);
  });

  it('renders only the overscan when no viewport is known', () => {
    const virtualizer = createVirtualizer({ count: 1000, estimateSize: () => 80, overscan: 2 });

    expect(virtualizer.getSnapshot().items).toHaveLength(3);
    expect(virtualizer.getViewportSize()).toBe(0);
  });

  it('no-ops on every call that would need the DOM', () => {
    const virtualizer = createVirtualizer({ count: 100, estimateSize: () => 80 });

    expect(() => {
      virtualizer.setScrollElement(null);
      virtualizer.measureElement(null);
      virtualizer.scrollToIndex(50);
      virtualizer.resetMeasurements();
      virtualizer.destroy();
    }).not.toThrow();
  });

  it('reports where the client should scroll to, without scrolling', () => {
    const virtualizer = createVirtualizer({
      count: 100,
      estimateSize: () => 80,
      initialViewport: 400,
    });

    expect(virtualizer.getOffsetForIndex(50, 'start')).toBe(4000);
  });
});
