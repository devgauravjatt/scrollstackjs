import { act, cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import { useCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVirtualizer, type UseVirtualizerOptions } from '../src/virtual';

/** jsdom has no layout: stand in for a scroll container the test can drive. */
function stubScroller(element: Element, viewport: number): (offset: number) => void {
  let offset = 0;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => offset,
    set: (value: number) => {
      offset = value;
    },
  });
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => viewport });
  return (next) => {
    offset = next;
    element.dispatchEvent(new Event('scroll'));
  };
}

let scrollTo: (offset: number) => void = () => {};
const stubbed = new WeakSet<Element>();

function Rows({ count, ...options }: Partial<UseVirtualizerOptions> & { count: number }) {
  const { items, totalSize, scrollRef, measureRef } = useVirtualizer({
    count,
    estimateSize: () => 100,
    overscan: 0,
    isScrollingDelay: 0,
    ...options,
  });

  // Stable identity, so React attaches the container once — the same thing a real
  // app gets for free from `scrollRef` and the reason it is a `useCallback`.
  const attach = useCallback(
    (node: Element | null) => {
      if (node !== null && !stubbed.has(node)) {
        stubbed.add(node);
        scrollTo = stubScroller(node, 300);
      }
      scrollRef(node);
    },
    [scrollRef],
  );

  return (
    <div data-testid="scroller" ref={attach}>
      <div data-testid="spacer" style={{ height: totalSize }}>
        {items.map((item) => (
          <div key={item.key} data-index={item.index} data-testid="row" ref={measureRef}>
            row {item.index}
          </div>
        ))}
      </div>
    </div>
  );
}

function rendered(): number[] {
  return screen.queryAllByTestId('row').map((row) => Number(row.getAttribute('data-index')));
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useVirtualizer', () => {
  it('renders only the window the viewport can show', () => {
    render(<Rows count={1000} />);

    expect(rendered()).toEqual([0, 1, 2]);
    expect(screen.getByTestId('spacer').style.height).toBe('100000px');
  });

  it('re-renders as the container scrolls', () => {
    render(<Rows count={1000} />);

    act(() => {
      scrollTo(5000);
    });

    expect(rendered()).toEqual([50, 51, 52]);
  });

  it('picks up a longer list on the very render that grows it', () => {
    const { rerender } = render(<Rows count={10} />);
    expect(screen.getByTestId('spacer').style.height).toBe('1000px');

    rerender(<Rows count={30} />);

    expect(screen.getByTestId('spacer').style.height).toBe('3000px');
  });

  it('stops listening once unmounted', () => {
    render(<Rows count={1000} />);
    const scroll = scrollTo;

    cleanup();

    expect(() => scroll(5000)).not.toThrow();
    expect(rendered()).toEqual([]);
  });
});
