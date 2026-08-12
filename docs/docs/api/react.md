# @scrollstackjs/react

0.32 KB gzipped, excluding peers. React 18+ (`useSyncExternalStore`).

```tsx
import { useInfiniteScroll } from '@scrollstackjs/react'
```

## useInfiniteScroll

```ts
function useInfiniteScroll<TData, TPageParam = number>(
  options: InfiniteScrollOptions<TData, TPageParam>,
): UseInfiniteScrollResult<TData, TPageParam>
```

Options are exactly [`InfiniteScrollOptions`](/api/core#infinitescrolloptions).
The result spreads the whole [snapshot](/api/core#infinitescrollsnapshot) and adds:

| Member         | Type                                | Description                                                       |
| -------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `ref`          | `(node: Element \| null) => void`   | Sentinel callback ref. Observes on attach, disconnects on detach. |
| `loadNextPage` | `() => Promise<void>`               | Load the next page manually.                                      |
| `retry`        | `() => Promise<void>`               | Clear the error and try again.                                    |
| `reset`        | `() => void`                        | Abort and return to the initial state.                            |
| `engine`       | `InfiniteScroll<TData, TPageParam>` | Escape hatch for events and plugins.                              |

```tsx
const {
  pages,
  pageParams,
  error,
  hasNextPage,
  failureCount,
  status,
  fetchStatus,
  isIdle,
  isLoading,
  isSuccess,
  isError,
  isFetching,
  isFetchingNextPage,
  ref,
  loadNextPage,
  retry,
  reset,
  engine,
} = useInfiniteScroll<Page, number>({/* … */})
```

## Behavior

- The engine is created **once**, on mount, and bound with
  `useSyncExternalStore(subscribe, getSnapshot, getSnapshot)` — concurrent-safe,
  and SSR-safe because the server snapshot is the idle snapshot.
- `destroy()` runs automatically on unmount. There is no `destroy` in the result.
- `ref`, `loadNextPage`, `retry`, `reset`, and `engine` are stable across renders,
  so they're safe as effect dependencies.

## Options are read once

::: warning
Changing `fetchPage`, `getNextPageParam`, `root`, or any other option across
renders does **not** re-create the engine. The values captured at mount are the
ones that run.
:::

When the data source genuinely changes, remount:

```tsx
<Feed key={userId} />
```

Or reset and let the new closure take effect on the next fetch — but only if the
change is in data your `fetchPage` reads from a ref, not in the function
identity. Remounting via `key` is the reliable path. Reactive options are on the
roadmap.

## Full example

```tsx
function Feed() {
  const {
    pages,
    ref,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    isFetching,
    retry,
    reset,
  } = useInfiniteScroll<UsersPage, number>({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) =>
      (await fetch(`/api/users?cursor=${pageParam}`, { signal })).json(),
    getNextPageParam: (last) => last.nextCursor,
  })

  const users = pages.flatMap((page) => page.users)
  const loadMoreFailed = error !== null && users.length > 0 && !isFetching

  return (
    <main>
      <button onClick={() => reset()}>Reset</button>

      {isLoading && <p>Loading…</p>}

      {error !== null && users.length === 0 && (
        <div role="alert">
          <p>Couldn’t load users.</p>
          <button onClick={() => void retry()}>Try again</button>
        </div>
      )}

      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>

      {hasNextPage && <div ref={ref}>{isFetchingNextPage ? 'Loading more…' : ' '}</div>}

      {loadMoreFailed && (
        <div role="alert">
          Failed to load more. <button onClick={() => void retry()}>Retry</button>
        </div>
      )}

      {!hasNextPage && users.length > 0 && <p>That’s everyone ({users.length}).</p>}
    </main>
  )
}
```

This is `examples/react-infinite-feed` in the repo, near-verbatim.

## Subscribing to events

```tsx
const { engine } = useInfiniteScroll({/* … */})

React.useEffect(() => engine.on('error', ({ error }) => toast.error(String(error))), [engine])
```

`engine.on` returns its unsubscribe function, which is exactly what an effect
cleanup wants.
