/**
 * Public type surface for `@scrollstackjs/core`.
 *
 * Everything a framework adapter or an application needs to talk to the engine
 * lives here. The engine itself ({@link ./engine.ts}) holds all business logic;
 * these types are the seam adapters bind to.
 */

/** Context passed to every {@link InfiniteScrollOptions.fetchPage} call. */
export interface FetchPageContext<TPageParam> {
  /** The page parameter to fetch (cursor, offset, page number — whatever you model). */
  readonly pageParam: TPageParam;
  /**
   * An `AbortSignal` that fires when the request is superseded, reset, or the
   * engine is destroyed. Forward it to `fetch(url, { signal })` to cancel in-flight work.
   */
  readonly signal: AbortSignal;
}

/**
 * Derives the parameter for the *next* page from the pages loaded so far.
 * Return `null` or `undefined` to signal there are no more pages
 * (this is what flips {@link InfiniteScrollSnapshot.hasNextPage} to `false`).
 *
 * This single function is how ScrollStack supports cursor, offset, and
 * page-number pagination without separate code paths — the strategy is data,
 * not branching logic.
 */
export type GetNextPageParam<TData, TPageParam> = (
  lastPage: TData,
  allPages: readonly TData[],
  lastPageParam: TPageParam,
  allPageParams: readonly TPageParam[],
) => TPageParam | null | undefined;

/** Controls whether a failed fetch is retried. */
export type RetryValue = boolean | number | ((failureCount: number, error: unknown) => boolean);

/** Controls how long to wait before an automatic retry, in milliseconds. */
export type RetryDelayValue = number | ((failureCount: number, error: unknown) => number);

/** Options for {@link createInfiniteScroll}. */
export interface InfiniteScrollOptions<TData, TPageParam = number> {
  /** Parameter used for the very first page fetch. */
  readonly initialPageParam: TPageParam;

  /** Fetches a single page. May be sync or async. Receives an {@link FetchPageContext}. */
  fetchPage(context: FetchPageContext<TPageParam>): TData | Promise<TData>;

  /** Derives the next page parameter, or `null`/`undefined` when exhausted. */
  getNextPageParam: GetNextPageParam<TData, TPageParam>;

  /**
   * Retry policy for failed fetches. Default: `3`.
   * - `number` — retry up to N times.
   * - `boolean` — retry always / never.
   * - `(failureCount, error) => boolean` — decide per failure.
   */
  readonly retry?: RetryValue;

  /**
   * Delay before an automatic retry. Default: exponential backoff
   * `min(1000 * 2 ** (attempt - 1), 30_000)`.
   */
  readonly retryDelay?: RetryDelayValue;

  /** When `true` (default), an intersecting target automatically loads the next page. */
  readonly autoLoad?: boolean;

  /** `root` for the underlying IntersectionObserver. */
  readonly root?: Element | Document | null;
  /** `rootMargin` for the underlying IntersectionObserver. */
  readonly rootMargin?: string;
  /** `threshold` for the underlying IntersectionObserver. */
  readonly threshold?: number | readonly number[];

  /** Plugins that extend the engine (analytics, persistence, logging, …). */
  readonly plugins?: readonly ScrollStackPlugin<TData, TPageParam>[];

  /** Called just before a page fetch begins. */
  onLoadStart?(info: { readonly pageParam: TPageParam }): void;
  /** Called after a page fetch resolves successfully. */
  onSuccess?(info: {
    readonly page: TData;
    readonly pageParam: TPageParam;
    readonly pages: readonly TData[];
  }): void;
  /** Called after a page fetch fails and all retries are exhausted. */
  onError?(info: { readonly error: unknown; readonly pageParam: TPageParam }): void;
}

/** Primary data status. */
export type ScrollStatus = 'idle' | 'pending' | 'success' | 'error';
/** Network status, orthogonal to {@link ScrollStatus}. */
export type FetchStatus = 'idle' | 'fetching';

/**
 * An immutable snapshot of engine state. The same object reference is returned
 * from {@link InfiniteScroll.getSnapshot} until state actually changes, which is
 * what makes it safe to feed directly into `useSyncExternalStore`.
 */
export interface InfiniteScrollSnapshot<TData, TPageParam = number> {
  /** Primary status describing the data. `'error'` means the *first* load failed (no usable data). */
  readonly status: ScrollStatus;
  /** Network status: is a request in flight right now? */
  readonly fetchStatus: FetchStatus;
  /** All successfully loaded pages, in order. */
  readonly pages: readonly TData[];
  /** The parameter used to fetch each page in {@link pages}. */
  readonly pageParams: readonly TPageParam[];
  /** The most recent error, or `null`. Set on *any* failure (including load-more failures), cleared on the next attempt. */
  readonly error: unknown;
  /** Whether another page is available to load. */
  readonly hasNextPage: boolean;
  /** Consecutive failures for the current fetch (resets to 0 on success). */
  readonly failureCount: number;

  /** No fetch has started yet. */
  readonly isIdle: boolean;
  /** The first page is loading and there is no data yet. */
  readonly isLoading: boolean;
  /** There is at least one page and no first-load error. */
  readonly isSuccess: boolean;
  /** The first load failed and there is no usable data. */
  readonly isError: boolean;
  /** A request is in flight (first page or a subsequent one). */
  readonly isFetching: boolean;
  /** A request for a *subsequent* page is in flight. */
  readonly isFetchingNextPage: boolean;
}

/** Events emitted by the engine; subscribe via {@link InfiniteScroll.on}. */
export interface ScrollStackEventMap<TData, TPageParam> {
  loadStart: { readonly pageParam: TPageParam };
  success: {
    readonly page: TData;
    readonly pageParam: TPageParam;
    readonly pages: readonly TData[];
  };
  error: { readonly error: unknown; readonly pageParam: TPageParam };
  reset: void;
}

/**
 * A plugin receives the engine instance and may subscribe to events or state.
 * Returning a function registers cleanup that runs on {@link InfiniteScroll.destroy}.
 */
export type ScrollStackPlugin<TData, TPageParam = number> = (
  instance: InfiniteScroll<TData, TPageParam>,
) => void | (() => void);

/** The engine instance returned by {@link createInfiniteScroll}. */
export interface InfiniteScroll<TData, TPageParam = number> {
  /** Returns the current immutable snapshot (stable reference until state changes). */
  getSnapshot(): InfiniteScrollSnapshot<TData, TPageParam>;
  /** Subscribes to state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Subscribes to a lifecycle event. Returns an unsubscribe function. */
  on<E extends keyof ScrollStackEventMap<TData, TPageParam>>(
    event: E,
    handler: (payload: ScrollStackEventMap<TData, TPageParam>[E]) => void,
  ): () => void;
  /** Loads the next page. No-ops if a fetch is in flight or there is no next page. */
  loadNextPage(): Promise<void>;
  /** Clears the failure count and retries. Use after an error. */
  retry(): Promise<void>;
  /** Aborts any in-flight work and returns to the initial state. */
  reset(): void;
  /** Starts observing a sentinel element; intersection triggers loading (SSR-safe no-op without a DOM). */
  observeTarget(target: Element): void;
  /** Stops observing the sentinel element. */
  destroyObserver(): void;
  /** Full teardown: aborts work, disconnects observers, runs plugin cleanups. */
  destroy(): void;
}
