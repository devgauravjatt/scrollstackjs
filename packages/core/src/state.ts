import type { FetchStatus, InfiniteScrollSnapshot, ScrollStatus } from './types';

/**
 * Internal engine state. This is the minimal source of truth; the public
 * {@link InfiniteScrollSnapshot} is derived from it (adding convenience booleans)
 * in {@link toSnapshot}.
 */
export interface CoreState<TData, TPageParam> {
  readonly status: ScrollStatus;
  readonly fetchStatus: FetchStatus;
  readonly pages: readonly TData[];
  readonly pageParams: readonly TPageParam[];
  readonly error: unknown;
  readonly hasNextPage: boolean;
  readonly failureCount: number;
}

/** State-machine events that drive {@link reduce}. */
export type CoreEvent<TData, TPageParam> =
  | { readonly type: 'FETCH_START' }
  | {
      readonly type: 'FETCH_SUCCESS';
      readonly page: TData;
      readonly pageParam: TPageParam;
      readonly hasNextPage: boolean;
    }
  | { readonly type: 'FETCH_ERROR'; readonly error: unknown; readonly failureCount: number }
  | { readonly type: 'FETCH_CANCELLED' }
  | { readonly type: 'RESET' };

/** The initial state: idle, no pages, assume a first page exists. */
export function initialState<TData, TPageParam>(): CoreState<TData, TPageParam> {
  return {
    status: 'idle',
    fetchStatus: 'idle',
    pages: [],
    pageParams: [],
    error: null,
    hasNextPage: true,
    failureCount: 0,
  };
}

/**
 * Pure state transition. Given the current state and an event, returns the next
 * state. No side effects, no async — the engine owns those and dispatches here.
 */
export function reduce<TData, TPageParam>(
  state: CoreState<TData, TPageParam>,
  event: CoreEvent<TData, TPageParam>,
): CoreState<TData, TPageParam> {
  switch (event.type) {
    case 'FETCH_START':
      return {
        ...state,
        // First load shows `pending`; loading a later page keeps `success` so the list stays visible.
        status: state.pages.length === 0 ? 'pending' : 'success',
        fetchStatus: 'fetching',
        error: null,
      };

    case 'FETCH_SUCCESS':
      return {
        status: 'success',
        fetchStatus: 'idle',
        pages: [...state.pages, event.page],
        pageParams: [...state.pageParams, event.pageParam],
        error: null,
        hasNextPage: event.hasNextPage,
        failureCount: 0,
      };

    case 'FETCH_ERROR':
      return {
        ...state,
        // A first-load failure is a true error (no data). A load-more failure keeps
        // `success` (existing pages are still valid) but surfaces `error` for a retry affordance.
        status: state.pages.length === 0 ? 'error' : 'success',
        fetchStatus: 'idle',
        error: event.error,
        failureCount: event.failureCount,
      };

    case 'FETCH_CANCELLED':
      return {
        ...state,
        fetchStatus: 'idle',
        status: state.pages.length === 0 ? 'idle' : 'success',
      };

    case 'RESET':
      return initialState<TData, TPageParam>();
  }
}

/** Derives the public snapshot (with convenience booleans) from internal state. */
export function toSnapshot<TData, TPageParam>(
  state: CoreState<TData, TPageParam>,
): InfiniteScrollSnapshot<TData, TPageParam> {
  const isFetching = state.fetchStatus === 'fetching';
  return {
    status: state.status,
    fetchStatus: state.fetchStatus,
    pages: state.pages,
    pageParams: state.pageParams,
    error: state.error,
    hasNextPage: state.hasNextPage,
    failureCount: state.failureCount,
    isIdle: state.status === 'idle',
    isLoading: state.status === 'pending',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isFetching,
    isFetchingNextPage: isFetching && state.pages.length > 0,
  };
}
