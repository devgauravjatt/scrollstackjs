# Core concepts

Four ideas explain most of the API. If you understand these, the rest of the
surface is mechanical.

## The engine is the whole library

`createInfiniteScroll` returns an engine that owns pagination, retry,
cancellation, the state machine, the event emitter, plugins, and the intersection
observer. Adapters bind exactly two of its methods — `subscribe` (state changed)
and `getSnapshot` (read current state) — and forward the controls.

That's why the React adapter is a few dozen lines and why adding another
framework is mechanical: there is no logic in an adapter worth porting.

```ts
const scroll = createInfiniteScroll({/* … */})

const unsubscribe = scroll.subscribe(() => render(scroll.getSnapshot()))
```

## Two-axis state

State is modeled on two orthogonal axes, because "do I have usable data?" and "is
a request in flight?" are independent questions:

| Axis          | Values                                   | Describes   |
| ------------- | ---------------------------------------- | ----------- |
| `status`      | `idle` · `pending` · `success` · `error` | the data    |
| `fetchStatus` | `idle` · `fetching`                      | the network |

Collapsing them into one enum forces a `loading` state that can't tell first-load
from load-more. Keeping them apart makes the derived booleans trivial:

```ts
isIdle // status === 'idle'
isLoading // status === 'pending'      — first page, no data yet
isSuccess // status === 'success'
isError // status === 'error'        — first load failed, no data
isFetching // fetchStatus === 'fetching'
isFetchingNextPage // fetching AND pages.length > 0
```

The consequence worth memorizing: **`isError` means the _first_ load failed.** A
failure while loading page 7 leaves `status: 'success'` — your seven pages are
still valid and still render — and sets `error`. See
[Errors & retry](/guide/errors-and-retry).

## Snapshots are referentially stable

`getSnapshot()` returns the _same object reference_ until state actually changes:

```ts
const a = scroll.getSnapshot()
const b = scroll.getSnapshot()
a === b // true — no state change in between
```

This is not an optimization detail, it's a contract. React's
`useSyncExternalStore` calls `getSnapshot` on every render and bails out of
re-rendering only when the reference is unchanged; building a fresh object per
call would loop forever. The same property is what lets the Vue adapter assign
straight into a `shallowRef` with no equality check.

Snapshots are also immutable — every field is `readonly`, and `pages` is replaced
wholesale rather than mutated. Derive from it freely (`pages.flatMap(…)`); never
write to it.

## Nothing survives a reset

The classic infinite-scroll bug is a slow response landing after the user
navigated away, resurrecting state that should be gone. Two mechanisms prevent
it:

1. **A generation counter.** Every fetch captures the current generation.
   `reset()`, `destroy()`, and any superseding fetch bump it. A result whose
   generation no longer matches is discarded — even if `fetchPage` ignored the
   abort signal entirely.
2. **An `AbortController`.** The signal is passed to `fetchPage` and aborted on
   reset or destroy, so well-behaved fetchers cancel real network work.

```ts
fetchPage: async ({ pageParam, signal }) => (await fetch(url, { signal })).json() // forward it — that's the whole contract
```

An abort is treated as a **cancellation, not a failure**: it doesn't increment
`failureCount`, doesn't set `error`, and doesn't emit the `error` event.

## Lifecycle

```
createInfiniteScroll(options)   →  status: 'idle', hasNextPage: true
  observeTarget(el)             →  intersection triggers loadNextPage()
  loadNextPage()                →  no-ops while fetching or when exhausted
  retry()                       →  clears failureCount + error, then fetches
  reset()                       →  aborts in flight, back to initial state
  destroy()                     →  aborts, disconnects, runs plugin cleanups
```

`hasNextPage` starts `true` — before the first fetch the engine assumes a first
page exists. It flips to `false` the moment `getNextPageParam` returns
`null`/`undefined`.

Adapters call `destroy()` for you on unmount (React) or scope dispose (Vue).
Svelte's store leaves it to you: `onDestroy(scroll.destroy)`.

## What lives outside core

Virtualization, persistence, pull-to-refresh, devtools, and alternative triggers
are deliberately _not_ in core — they'd blow the size budget for apps that don't
use them. Core defines contracts (`Trigger`, `GetNextPageParam`) that those
packages build on. See [Architecture decisions](/decisions), ADR-001.
