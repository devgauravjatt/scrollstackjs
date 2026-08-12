# Getting started

ScrollStack is a headless infinite-scroll engine. It owns the behavior —
pagination, retry, cancellation, the state machine, the intersection observer —
and hands you a snapshot to render however you like. There are no components and
no styles in any package.

## Install

Install the adapter for your framework — it pulls in `@scrollstackjs/core` for you.

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

```bash [Core only]
npm i @scrollstackjs/core
```

:::

## Usage

Same engine, three bindings. Pick your tab:

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'

interface Page {
  items: Item[]
  nextCursor: number | null
}

function Feed() {
  const { pages, ref, isLoading, isFetchingNextPage, hasNextPage } = useInfiniteScroll<
    Page,
    number
  >({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) =>
      (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
    getNextPageParam: (last) => last.nextCursor,
  })

  const items = pages.flatMap((page) => page.items)

  if (isLoading) return <p>Loading…</p>

  return (
    <ul>
      {items.map((item) => (
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

const { state, target } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
  getNextPageParam: (last) => last.nextCursor,
})
</script>

<template>
  <ul>
    <li v-for="item in state.pages.flatMap((p) => p.items)" :key="item.id">
      {{ item.name }}
    </li>
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

<ul>
  {#each $scroll.pages.flatMap((p) => p.items) as item (item.id)}
    <li>{item.name}</li>
  {/each}
  {#if $scroll.hasNextPage}
    <li use:target>{$scroll.isFetchingNextPage ? 'Loading more…' : ''}</li>
  {/if}
</ul>
```

:::

Two per-framework notes:

- **Vue.** `state` is a `shallowRef`. Templates unwrap it automatically; in
  `<script setup>` read `state.value.pages`.
- **Svelte.** The returned object _is_ a store, so `$scroll` is the snapshot. This
  is the one adapter where teardown is manual — call `scroll.destroy()` in
  `onDestroy`. React unmounts and Vue's scope dispose handle it for you.

## The sentinel

`ref` / `:ref="target"` / `use:target` all do the same thing: they hand an element
to the engine's `IntersectionObserver`. When that element scrolls into view, the
next page loads.

Two rules the observer imposes:

- **The sentinel needs layout size.** A zero-height (or zero-width, in a
  horizontal rail) element never intersects anything.
- **Intersection fires on transitions.** If a freshly loaded page doesn't push the
  sentinel back out of view, nothing re-triggers. Load enough per page to overflow
  the viewport, or call `loadNextPage()` yourself.

Rendering the sentinel only while `hasNextPage` is true — as every example above
does — also gives you a natural end-of-list state.

The React feed shows all five states you actually render: first load, rows,
loading-more, error-with-retry, and end-of-list. The horizontal rail shows the
container-scoped variant — see [Horizontal & scoped scrolling](/guide/horizontal).

## Next

- [Core concepts](/guide/concepts) — the two-axis state machine and why snapshots
  are referentially stable.
- [Pagination](/guide/pagination) — cursor, offset, and page-number in one
  function.
- [Errors & retry](/guide/errors-and-retry) — including why a load-more failure
  keeps your list on screen.
