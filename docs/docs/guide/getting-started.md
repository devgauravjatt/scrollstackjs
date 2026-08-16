# Getting started

ScrollStack has no components and no styles. You give it three options, it gives
you a snapshot, and you render that however you like.

## 1. Install

::: code-group

```bash [React]
npm i @scrollstackjs/react
```

```bash [Vue]
npm i @scrollstackjs/vue
```

```bash [Svelte]
npm i @scrollstackjs/svelte
```

```bash [No framework]
npm i @scrollstackjs/core
```

:::

The adapter pulls in `@scrollstackjs/core` for you — you never install it yourself.

## 2. Paste this

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'

function Feed() {
  const { pages, ref, isLoading, hasNextPage, isFetchingNextPage } = useInfiniteScroll({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) =>
      (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
    getNextPageParam: (last) => last.nextCursor,
  })

  if (isLoading) return <p>Loading…</p>

  return (
    <ul>
      {pages
        .flatMap((page) => page.items)
        .map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}

      {hasNextPage && <li ref={ref}>{isFetchingNextPage ? 'Loading more…' : ''}</li>}
    </ul>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

const { state, target } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
  getNextPageParam: (last) => last.nextCursor,
})

const items = computed(() => state.value.pages.flatMap((page) => page.items))
</script>

<template>
  <p v-if="state.isLoading">Loading…</p>

  <ul v-else>
    <li v-for="item in items" :key="item.id">{{ item.name }}</li>

    <li v-if="state.hasNextPage" :ref="target">
      {{ state.isFetchingNextPage ? 'Loading more…' : '' }}
    </li>
  </ul>
</template>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) =>
      (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
    getNextPageParam: (last) => last.nextCursor,
  })

  const { target } = scroll
  onDestroy(scroll.destroy)
</script>

{#if $scroll.isLoading}
  <p>Loading…</p>
{:else}
  <ul>
    {#each $scroll.pages.flatMap((page) => page.items) as item (item.id)}
      <li>{item.name}</li>
    {/each}

    {#if $scroll.hasNextPage}
      <li use:target>{$scroll.isFetchingNextPage ? 'Loading more…' : ''}</li>
    {/if}
  </ul>
{/if}
```

```ts [No framework]
import { createInfiniteScroll } from '@scrollstackjs/core'

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
  getNextPageParam: (last) => last.nextCursor,
})

// Runs on every change. Read the current state and paint it.
scroll.subscribe(() => {
  const { pages, hasNextPage } = scroll.getSnapshot()
  render(pages.flatMap((page) => page.items))
  sentinel.hidden = !hasNextPage
})

scroll.observeTarget(sentinel)
```

:::

Two framework notes:

- **Vue** — `state` is a ref. In the template it unwraps by itself; in
  `<script setup>` write `state.value.pages`.
- **Svelte** — the returned object _is_ a store, so `$scroll` is the state. This is
  the one adapter where you clean up by hand: `onDestroy(scroll.destroy)`.

## 3. What you get back

The fields you will actually use, most of the time:

| Field                | Meaning                                                  |
| -------------------- | -------------------------------------------------------- |
| `pages`              | Every page loaded so far, in order. Flatten it yourself. |
| `isLoading`          | First page is loading and there is nothing to show yet.  |
| `isFetchingNextPage` | A later page is loading. Your rows are still on screen.  |
| `hasNextPage`        | There is more to load.                                   |
| `isError`            | The **first** load failed, so there is nothing to show.  |
| `error`              | The last error, or `null`. Set on _any_ failure.         |
| `retry()`            | Try again after a failure.                               |
| `reset()`            | Empty the list and start over.                           |
| `loadNextPage()`     | Load the next page yourself, instead of scrolling.       |

There are a few more (`status`, `fetchStatus`, `pageParams`, `failureCount`,
`isIdle`, `isSuccess`, `isFetching`) — see the [API reference](/api/core).

## The sentinel — one rule

`ref` / `:ref="target"` / `use:target` all do the same thing: they hand an element
to the engine. When that element scrolls into view, the next page loads.

::: warning It must have a size
A `<div>` with nothing in it is 0px tall and never scrolls into view — so nothing
ever loads. Give the sentinel text, a spinner, or a height.
:::

Also: the trigger fires when the element _enters_ view. If a loaded page is too
short to push the sentinel back out of view, nothing fires again. Load enough rows
per page to overflow the screen, or call `loadNextPage()` yourself.

Rendering the sentinel only while `hasNextPage` is true — as every example above
does — gives you an end-of-list state for free.

## Next

- **[Examples](/examples/)** — running demos with full code: retries, virtual
  lists, horizontal rails, devtools.
- **[Pagination](/guide/pagination)** — cursor, offset and page numbers.
- **[Errors & retry](/guide/errors-and-retry)** — why a failed _load more_ keeps
  your list on screen.
