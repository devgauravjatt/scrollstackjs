# Core concepts

Three things explain most of the API.

## 1. You get pages, not items

`pages` is an array of whatever your `fetchPage` returned. The library never looks
inside it, so flattening is yours to do:

```ts
const items = pages.flatMap((page) => page.items)
```

That is on purpose — a page often carries more than rows (a total count, a
timestamp, filters), and flattening for you would throw it away.

## 2. `isError` only means the _first_ load failed

This is the one that surprises people.

- **First page fails** → nothing to show → `isError` is `true`.
- **Page 7 fails** → your six pages are still fine → `isError` stays `false`, and
  `error` is set beside them.

So a failed "load more" is invisible to `isError`. Check for it like this:

```ts
const loadMoreFailed = error !== null && pages.length > 0 && !isFetching
```

Show a "couldn't load more, try again" row and keep your list on screen. Full
details in [Errors & retry](/guide/errors-and-retry).

## 3. Old responses can't overwrite your list

The classic infinite-scroll bug is a slow response landing after the user changed
the filter, refilling the list with stale rows. That cannot happen here: when you
call `reset()` (or the component unmounts), anything already in flight is
cancelled and ignored when it arrives.

Your only job is to pass the signal along:

```ts
fetchPage: async ({ pageParam, signal }) => (await fetch(url, { signal })).json()
```

A cancelled request is not a failure — it doesn't count toward retries and doesn't
set `error`.

## The state, in one table

| Field                | `true` when…                                       |
| -------------------- | -------------------------------------------------- |
| `isIdle`             | Nothing has been fetched yet.                      |
| `isLoading`          | First page is loading, nothing to show.            |
| `isSuccess`          | You have at least one page.                        |
| `isError`            | The first load failed.                             |
| `isFetching`         | Any request is in flight.                          |
| `isFetchingNextPage` | A _later_ page is loading, rows already on screen. |

These are derived from two fields you can also read directly: `status`
(`idle` / `pending` / `success` / `error`, about your data) and `fetchStatus`
(`idle` / `fetching`, about the network).

## Lifecycle

```
createInfiniteScroll(options)   →  idle, hasNextPage: true
  observeTarget(el)             →  scrolling into view loads the next page
  loadNextPage()                →  does nothing while fetching, or at the end
  retry()                       →  clears the error, tries the same page again
  reset()                       →  cancels, empties, back to the start
  destroy()                     →  cancels and detaches everything
```

`hasNextPage` starts `true` — before the first fetch the library assumes a first
page exists. It becomes `false` the moment `getNextPageParam` returns `null`.

React and Vue call `destroy()` for you when the component goes away. Svelte does
not: `onDestroy(scroll.destroy)`.

## What's in other packages

Virtualization ([`@scrollstackjs/virtual`](/examples/virtual)) and the inspector
panel ([`@scrollstackjs/devtools`](/examples/devtools)) are separate installs, so
apps that don't use them don't pay for them.
