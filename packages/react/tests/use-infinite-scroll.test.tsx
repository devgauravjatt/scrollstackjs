import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInfiniteScroll } from '../src/index';

/** IntersectionObserver stand-in so the ref callback has something to attach to. */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  private readonly cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    MockIntersectionObserver.instances.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface Item {
  readonly id: number;
}

function Feed(): React.ReactElement {
  const { pages, ref, loadNextPage, hasNextPage, isFetchingNextPage } = useInfiniteScroll<
    Item,
    number
  >({
    initialPageParam: 0,
    fetchPage: async ({ pageParam }) => ({ id: pageParam }),
    getNextPageParam: (last) => (last.id < 2 ? last.id + 1 : null),
  });

  return (
    <div>
      <span data-testid="count">{pages.length}</span>
      <span data-testid="last">{pages[pages.length - 1]?.id ?? 'none'}</span>
      <span data-testid="hasNext">{String(hasNextPage)}</span>
      <button type="button" onClick={() => void loadNextPage()}>
        {isFetchingNextPage ? 'loading' : 'more'}
      </button>
      <div ref={ref} data-testid="sentinel" />
    </div>
  );
}

describe('useInfiniteScroll', () => {
  it('starts empty and renders the idle snapshot', () => {
    render(<Feed />);
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('hasNext').textContent).toBe('true');
  });

  it('loads pages when the control is used and re-renders via the store', async () => {
    render(<Feed />);
    const more = screen.getByRole('button');

    fireEvent.click(more);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('last').textContent).toBe('0');

    fireEvent.click(more);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    fireEvent.click(more);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('3'));

    // getNextPageParam returned null on the third page.
    await waitFor(() => expect(screen.getByTestId('hasNext').textContent).toBe('false'));
  });
});
