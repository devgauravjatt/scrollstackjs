import { describe, expect, it } from 'vitest';

import { createInfiniteScroll } from '../src/index';
import { deferred, type Page } from './helpers';

describe('cancellation', () => {
  it('aborts the in-flight signal on reset()', () => {
    let captured: AbortSignal | undefined;
    const gate = deferred<Page>();

    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: ({ signal }) => {
        captured = signal;
        return gate.promise;
      },
      getNextPageParam: (last) => last.cursor,
    });

    void scroll.loadNextPage();
    expect(captured?.aborted).toBe(false);

    scroll.reset();
    expect(captured?.aborted).toBe(true);
  });

  it('aborts the in-flight signal on destroy()', () => {
    let captured: AbortSignal | undefined;
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: ({ signal }) => {
        captured = signal;
        return deferred<Page>().promise;
      },
      getNextPageParam: (last) => last.cursor,
    });

    void scroll.loadNextPage();
    scroll.destroy();
    expect(captured?.aborted).toBe(true);
  });

  it('a rejection caused by an abort is not treated as an error', async () => {
    const scroll = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: ({ signal }) =>
        new Promise<Page>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      getNextPageParam: (last) => last.cursor,
      retry: 3,
    });

    const inflight = scroll.loadNextPage();
    scroll.reset();
    await inflight;

    const snap = scroll.getSnapshot();
    expect(snap.isError).toBe(false);
    expect(snap.error).toBeNull();
    expect(snap.failureCount).toBe(0); // an abort must not count as a failure or trigger retries
    expect(snap.isIdle).toBe(true);
  });
});
