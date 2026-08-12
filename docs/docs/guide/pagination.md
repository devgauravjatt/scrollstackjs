# Pagination

Cursor, offset/limit, and page-number pagination are not three APIs. They are
three implementations of one function:

```ts
getNextPageParam(lastPage, allPages, lastPageParam, allPageParams)
  => TPageParam | null | undefined // null/undefined = no more pages
```

The engine never branches on a pagination "strategy" — the strategy is data you
supply. That's what keeps the core tiny and lets pagination shapes nobody
anticipated work anyway.

## Cursor

The server hands back the next cursor; you return it.

```ts
interface Page {
  items: Item[]
  nextCursor: string | null
}

createInfiniteScroll<Page, string>({
  initialPageParam: 'start',
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
  getNextPageParam: (last) => last.nextCursor, // null ends it
})
```

## Offset / limit

There is no cursor in the response, so derive the next offset from the last
param — and stop when a short page proves you've hit the end.

```ts
const LIMIT = 20

createInfiniteScroll<Item[], number>({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/items?offset=${pageParam}&limit=${LIMIT}`, { signal })).json(),
  getNextPageParam: (lastPage, _allPages, lastParam) =>
    lastPage.length === LIMIT ? lastParam + LIMIT : null,
})
```

## Page number

```ts
createInfiniteScroll<Page, number>({
  initialPageParam: 1,
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/items?page=${pageParam}`, { signal })).json(),
  getNextPageParam: (last, _allPages, lastParam) =>
    lastParam < last.totalPages ? lastParam + 1 : null,
})
```

## `0` is a valid page param

The engine checks `== null`, never truthiness. Offset `0`, page `0`, and an empty
string cursor are all real params that fetch real pages; only `null` and
`undefined` end the list. There's a regression test for exactly this in
`pagination.test.ts`.

```ts
// Correct — ends only when there is genuinely nothing left.
getNextPageParam: (last) => last.nextOffset ?? null

// Wrong — offset 0 silently terminates the list.
getNextPageParam: (last) => last.nextOffset || null
```

## The arguments you rarely need

All four parameters are there so you never have to keep state outside the engine:

| Parameter       | Use it when                                                       |
| --------------- | ----------------------------------------------------------------- |
| `lastPage`      | the response carries the next cursor (the common case)            |
| `allPages`      | the count of loaded pages _is_ the next param (`allPages.length`) |
| `lastPageParam` | you're incrementing an offset or page number                      |
| `allPageParams` | you need the full history — deduping, or a time-window walk       |

```ts
// "Next page number is however many pages I already have, plus one."
getNextPageParam: (last, allPages) => (last.hasMore ? allPages.length + 1 : null)
```

## Reading the pages

`pages` is an array of whatever `fetchPage` returned, in load order. Flatten it
at render time:

```ts
const items = pages.flatMap((page) => page.items)
```

`pageParams` is the parallel array of the params used to fetch each page — handy
for debugging, and for `refetch`-style logic you build yourself.

## Bi-directional pagination

Not supported yet. `getPreviousPageParam` is on the roadmap; today the engine only
walks forward. If you need "load older messages above", track the backward cursor
yourself and prepend, or run a second engine for the other direction.
