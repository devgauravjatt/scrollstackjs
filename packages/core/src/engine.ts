import { createEmitter } from './emitter';
import { describeValue, invariant, isElement } from './errors';
import { createIntersectionTrigger, type Trigger } from './observer';
import { DEFAULT_RETRY, DEFAULT_RETRY_DELAY, resolveRetry, resolveRetryDelay } from './retry';
import { initialState, reduce, toSnapshot, type CoreState } from './state';
import type {
  InfiniteScroll,
  InfiniteScrollOptions,
  InfiniteScrollSnapshot,
  ScrollStackEventMap,
} from './types';

/**
 * Creates a framework-agnostic infinite-scroll engine. This is the single source
 * of truth: pagination, retry, cancellation, the state machine, events, and the
 * observer all live here. Framework adapters only bind to {@link InfiniteScroll.subscribe}
 * and {@link InfiniteScroll.getSnapshot} and forward lifecycle.
 *
 * @example
 * const scroll = createInfiniteScroll({
 *   initialPageParam: 0,
 *   fetchPage: async ({ pageParam, signal }) => {
 *     const res = await fetch(`/api/items?cursor=${pageParam}`, { signal });
 *     return res.json();
 *   },
 *   getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
 * });
 *
 * scroll.subscribe(() => render(scroll.getSnapshot()));
 * scroll.observeTarget(sentinelEl); // loads the next page when it scrolls into view
 */
export function createInfiniteScroll<TData, TPageParam = number>(
  options: InfiniteScrollOptions<TData, TPageParam>,
): InfiniteScroll<TData, TPageParam> {
  invariant(
    typeof options?.fetchPage === 'function',
    '[ScrollStack] `fetchPage` is required and must be a function.',
  );
  invariant(
    typeof options.getNextPageParam === 'function',
    '[ScrollStack] `getNextPageParam` is required and must be a function.',
  );
  invariant(
    'initialPageParam' in options,
    '[ScrollStack] `initialPageParam` is required (it is used to fetch the first page).',
  );

  const {
    fetchPage,
    getNextPageParam,
    initialPageParam,
    retry = DEFAULT_RETRY,
    retryDelay = DEFAULT_RETRY_DELAY,
    autoLoad = true,
    root = null,
    rootMargin,
    threshold,
    plugins = [],
    onLoadStart,
    onSuccess,
    onError,
  } = options;

  let state: CoreState<TData, TPageParam> = initialState<TData, TPageParam>();
  let snapshot: InfiniteScrollSnapshot<TData, TPageParam> = toSnapshot(state);

  const listeners = new Set<() => void>();
  const emitter = createEmitter<ScrollStackEventMap<TData, TPageParam>>();
  const cleanups: Array<() => void> = [];

  // `generation` guards against stale async: every fetch captures the current
  // generation; a reset/destroy/new-fetch bumps it, so a late-resolving request
  // whose generation no longer matches is ignored instead of corrupting state.
  let generation = 0;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let trigger: Trigger | null = null;
  let destroyed = false;

  function commit(next: CoreState<TData, TPageParam>): void {
    state = next;
    snapshot = toSnapshot(next); // new object only on real change -> stable reference between changes
    for (const listener of listeners) listener();
  }

  /** The parameter for the next fetch, or `null` when there are no more pages. */
  function nextParam(): TPageParam | null {
    if (state.pages.length === 0) return initialPageParam;
    const last = state.pages[state.pages.length - 1]!;
    const lastParam = state.pageParams[state.pageParams.length - 1]!;
    const derived = getNextPageParam(last, state.pages, lastParam, state.pageParams);
    return derived == null ? null : derived;
  }

  function clearRetryTimer(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  async function run(): Promise<void> {
    if (destroyed) return;
    if (state.fetchStatus === 'fetching') return; // dedupe concurrent triggers
    clearRetryTimer();

    const param = nextParam();
    if (param === null) {
      if (state.hasNextPage) commit({ ...state, hasNextPage: false });
      return;
    }

    commit(reduce(state, { type: 'FETCH_START' }));
    emitter.emit('loadStart', { pageParam: param });
    onLoadStart?.({ pageParam: param });

    const id = ++generation;
    controller = new AbortController();
    const { signal } = controller;

    try {
      const page = await fetchPage({ pageParam: param, signal });
      if (id !== generation || destroyed) return; // superseded while awaiting

      const nextPages = [...state.pages, page];
      const nextParams = [...state.pageParams, param];
      const following = getNextPageParam(page, nextPages, param, nextParams);

      commit(
        reduce(state, {
          type: 'FETCH_SUCCESS',
          page,
          pageParam: param,
          hasNextPage: following != null,
        }),
      );
      emitter.emit('success', { page, pageParam: param, pages: state.pages });
      onSuccess?.({ page, pageParam: param, pages: state.pages });
    } catch (error) {
      if (id !== generation || destroyed) return;

      // A cancellation is not a failure: revert quietly, don't count it, don't emit error.
      if (signal.aborted) {
        commit(reduce(state, { type: 'FETCH_CANCELLED' }));
        return;
      }

      const failureCount = state.failureCount + 1;
      if (resolveRetry(retry, failureCount, error)) {
        commit({ ...state, failureCount, fetchStatus: 'idle' });
        const delay = resolveRetryDelay(retryDelay, failureCount, error);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void run();
        }, delay);
        return;
      }

      commit(reduce(state, { type: 'FETCH_ERROR', error, failureCount }));
      emitter.emit('error', { error, pageParam: param });
      onError?.({ error, pageParam: param });
    } finally {
      if (id === generation) controller = null;
    }
  }

  function loadNextPage(): Promise<void> {
    return run();
  }

  function retryFn(): Promise<void> {
    if (state.failureCount !== 0 || state.error !== null) {
      commit({ ...state, failureCount: 0, error: null });
    }
    return run();
  }

  function reset(): void {
    generation++;
    if (controller) {
      controller.abort();
      controller = null;
    }
    clearRetryTimer();
    commit(initialState<TData, TPageParam>());
    emitter.emit('reset');
  }

  function destroyObserver(): void {
    if (trigger) {
      trigger.disconnect();
      trigger = null;
    }
  }

  function observeTarget(el: Element): void {
    const domAvailable = typeof IntersectionObserver !== 'undefined';
    if (domAvailable) {
      invariant(
        isElement(el),
        `[ScrollStack] observeTarget expected an Element but received ${describeValue(el)}. ` +
          'Attach the sentinel ref to a DOM node before observing.',
      );
    }
    destroyObserver();
    trigger = createIntersectionTrigger({
      root,
      rootMargin,
      threshold,
      onIntersect: () => {
        if (autoLoad) void run();
      },
    });
    trigger?.observe(el);
  }

  function destroy(): void {
    destroyed = true;
    generation++;
    if (controller) {
      controller.abort();
      controller = null;
    }
    clearRetryTimer();
    destroyObserver();
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
    listeners.clear();
    emitter.clear();
  }

  const instance: InfiniteScroll<TData, TPageParam> = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    on: (event, handler) => emitter.on(event, handler),
    loadNextPage,
    retry: retryFn,
    reset,
    observeTarget,
    destroyObserver,
    destroy,
  };

  for (const plugin of plugins) {
    const cleanup = plugin(instance);
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }

  return instance;
}
