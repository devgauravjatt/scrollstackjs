# @scrollstackjs/core

The engine. Zero runtime dependencies, 1.92 KB gzipped, no framework knowledge.

```ts
import { createInfiniteScroll } from '@scrollstackjs/core'
```

## createInfiniteScroll

```ts
function createInfiniteScroll<TData, TPageParam = number>(
  options: InfiniteScrollOptions<TData, TPageParam>,
): InfiniteScroll<TData, TPageParam>
```

`TData` is whatever one page looks like; `TPageParam` is your cursor type.
Throws `ScrollStackError` if `fetchPage`, `getNextPageParam`, or
`initialPageParam` is missing.

## InfiniteScrollOptions

### Required

| Option             | Type                                                             | Description                                               |
| ------------------ | ---------------------------------------------------------------- | --------------------------------------------------------- |
| `initialPageParam` | `TPageParam`                                                     | Param used for the very first fetch.                      |
| `fetchPage`        | `(ctx: FetchPageContext<TPageParam>) => TData \| Promise<TData>` | Fetches one page. May be sync.                            |
| `getNextPageParam` | `GetNextPageParam<TData, TPageParam>`                            | Derives the next param; `null`/`undefined` ends the list. |

### Retry

| Option       | Type                                                                     | Default                                  |
| ------------ | ------------------------------------------------------------------------ | ---------------------------------------- |
| `retry`      | `boolean \| number \| (failureCount: number, error: unknown) => boolean` | `3`                                      |
| `retryDelay` | `number \| (failureCount: number, error: unknown) => number`             | `min(1000 * 2 ** (attempt - 1), 30_000)` |

`failureCount` is `1` on the first failure. `true` retries forever, `false` never.

### Observer

| Option       | Type                          | Default           | Description                                        |
| ------------ | ----------------------------- | ----------------- | -------------------------------------------------- |
| `autoLoad`   | `boolean`                     | `true`            | Whether intersection triggers a load at all.       |
| `root`       | `Element \| Document \| null` | `null` (viewport) | IntersectionObserver root.                         |
| `rootMargin` | `string`                      | —                 | Margin around the root: `'top right bottom left'`. |
| `threshold`  | `number \| readonly number[]` | —                 | Intersection ratio(s).                             |

All three observer options are passed straight through to
`IntersectionObserver`. See [Horizontal & scoped scrolling](/guide/horizontal)
for when `root` earns its keep.

### Lifecycle

| Option        | Signature                              | Fires                       |
| ------------- | -------------------------------------- | --------------------------- |
| `onLoadStart` | `({ pageParam }) => void`              | before each fetch           |
| `onSuccess`   | `({ page, pageParam, pages }) => void` | after a page resolves       |
| `onError`     | `({ error, pageParam }) => void`       | after retries are exhausted |
| `plugins`     | `readonly ScrollStackPlugin[]`         | run once, at creation       |

## FetchPageContext

```ts
interface FetchPageContext<TPageParam> {
  readonly pageParam: TPageParam
  readonly signal: AbortSignal // aborts on supersede, reset, or destroy
}
```

Forward `signal` to `fetch` so cancellations cancel real network work.

## GetNextPageParam

```ts
type GetNextPageParam<TData, TPageParam> = (
  lastPage: TData,
  allPages: readonly TData[],
  lastPageParam: TPageParam,
  allPageParams: readonly TPageParam[],
) => TPageParam | null | undefined
```

Only `null` and `undefined` end the list — `0` and `''` are valid params. See
[Pagination](/guide/pagination).

## InfiniteScroll

The returned engine.

| Method            | Signature                              | Notes                                                |
| ----------------- | -------------------------------------- | ---------------------------------------------------- |
| `getSnapshot`     | `() => InfiniteScrollSnapshot`         | Same reference until state changes.                  |
| `subscribe`       | `(listener: () => void) => () => void` | Returns unsubscribe.                                 |
| `on`              | `(event, handler) => () => void`       | Returns unsubscribe.                                 |
| `loadNextPage`    | `() => Promise<void>`                  | No-ops while fetching or when exhausted.             |
| `retry`           | `() => Promise<void>`                  | Clears `failureCount` and `error`, then fetches.     |
| `reset`           | `() => void`                           | Aborts in flight; back to initial state.             |
| `observeTarget`   | `(target: Element) => void`            | Replaces any previous target. SSR no-op.             |
| `destroyObserver` | `() => void`                           | Stops observing; engine stays usable.                |
| `destroy`         | `() => void`                           | Aborts, disconnects, runs plugin cleanups. Terminal. |

The control methods are bound — destructuring them is safe:

```ts
const { loadNextPage, reset } = scroll
```

## InfiniteScrollSnapshot

```ts
interface InfiniteScrollSnapshot<TData, TPageParam = number> {
  readonly status: 'idle' | 'pending' | 'success' | 'error'
  readonly fetchStatus: 'idle' | 'fetching'
  readonly pages: readonly TData[]
  readonly pageParams: readonly TPageParam[]
  readonly error: unknown
  readonly hasNextPage: boolean
  readonly failureCount: number

  readonly isIdle: boolean // status === 'idle'
  readonly isLoading: boolean // status === 'pending' — first page, no data
  readonly isSuccess: boolean
  readonly isError: boolean // first load failed, nothing to show
  readonly isFetching: boolean
  readonly isFetchingNextPage: boolean // fetching && pages.length > 0
}
```

`hasNextPage` starts `true` — before the first fetch the engine assumes a page
exists. `error` is set on _any_ failure, including load-more failures where
`status` stays `'success'`; it's cleared when the next attempt starts.

## Events

```ts
interface ScrollStackEventMap<TData, TPageParam> {
  loadStart: { readonly pageParam: TPageParam }
  success: {
    readonly page: TData
    readonly pageParam: TPageParam
    readonly pages: readonly TData[]
  }
  error: { readonly error: unknown; readonly pageParam: TPageParam }
  reset: void
}
```

## ScrollStackPlugin

```ts
type ScrollStackPlugin<TData, TPageParam = number> = (
  instance: InfiniteScroll<TData, TPageParam>,
) => void | (() => void) // returned function runs on destroy()
```

See [Events & plugins](/guide/events-and-plugins).

## Trigger

The observer seam. Core ships one implementation and depends only on the
contract, so alternative triggers (scroll events, manual, mutation-based) can live
in their own packages.

```ts
interface Trigger {
  observe(target: Element): void
  disconnect(): void
}

function createIntersectionTrigger(options: IntersectionTriggerOptions): Trigger | null // null when there is no IntersectionObserver
```

## Errors

```ts
class ScrollStackError extends Error {}
```

Thrown synchronously for misconfiguration — missing required options, or an
`observeTarget` argument that isn't an `Element`. Fetch failures never surface as
`ScrollStackError`; they land in `snapshot.error` as whatever your `fetchPage`
threw.

## Also exported

| Export                                  | Purpose                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `createEmitter`                         | The tiny typed emitter core uses internally.                  |
| `DEFAULT_RETRY` / `DEFAULT_RETRY_DELAY` | The defaults, if you want to extend rather than replace them. |
| `resolveRetry` / `resolveRetryDelay`    | Normalize a `RetryValue`/`RetryDelayValue` to a decision.     |

Types: `FetchPageContext`, `GetNextPageParam`, `RetryValue`, `RetryDelayValue`,
`InfiniteScrollOptions`, `InfiniteScrollSnapshot`, `InfiniteScroll`,
`ScrollStatus`, `FetchStatus`, `ScrollStackEventMap`, `ScrollStackPlugin`,
`Trigger`, `IntersectionTriggerOptions`, `Emitter`, `EventMap`.
