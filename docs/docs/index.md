---
layout: home

hero:
  name: ScrollStack
  text: Headless infinite scrolling
  tagline: One tiny engine — pagination, retry, cancellation, observers. You bring the markup.
  actions:
    - theme: brand
      text: Start the tutorial
      link: /tutorial
    - theme: alt
      text: Live demo
      link: /demo

features:
  - title: 1.92 KB gzipped
    details: The core engine has zero runtime dependencies. The React adapter adds 0.32 KB — adapters are thin bindings, not second implementations.
  - title: Framework-agnostic
    details: React, Vue, and Svelte adapters ship today, each binding the same two methods — subscribe and getSnapshot. Adding another is mechanical.
  - title: Pagination is one function
    details: Cursor, offset, and page-number pagination are different getNextPageParam implementations, not different APIs.
  - title: Correct under concurrency
    details: A generation counter plus AbortController means a stale response landing after a reset can never resurrect dead state.
---

## The 10-second version

Same options, same snapshot, same controls — only the binding changes. The
sentinel (`ref` / `:ref="target"` / `use:target`) loads the next page when it
scrolls into view.

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'

function Feed() {
  const { pages, ref, hasNextPage, isFetchingNextPage } = useInfiniteScroll({
    initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
    fetchPage: async ({ pageParam, signal }) => (await fetch(pageParam, { signal })).json(),
    getNextPageParam: (last) => last.info.next, // null = no more pages
  })

  return (
    <ul>
      {pages
        .flatMap((p) => p.results)
        .map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      {hasNextPage && <li ref={ref}>{isFetchingNextPage ? 'Loading…' : ''}</li>}
    </ul>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { computed } from 'vue'
import { useInfiniteScroll } from '@scrollstackjs/vue'

const { state, target } = useInfiniteScroll({
  initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
  fetchPage: async ({ pageParam, signal }) => (await fetch(pageParam, { signal })).json(),
  getNextPageParam: (last) => last.info.next, // null = no more pages
})

const characters = computed(() => state.value.pages.flatMap((p) => p.results))
</script>

<template>
  <ul>
    <li v-for="c in characters" :key="c.id">{{ c.name }}</li>
    <li v-if="state.hasNextPage" :ref="target">
      {{ state.isFetchingNextPage ? 'Loading…' : '' }}
    </li>
  </ul>
</template>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  const scroll = createInfiniteScroll({
    initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
    fetchPage: async ({ pageParam, signal }) =>
      (await fetch(pageParam, { signal })).json(),
    getNextPageParam: (last) => last.info.next, // null = no more pages
  })
  const { target } = scroll
  onDestroy(scroll.destroy)
</script>

<ul>
  {#each $scroll.pages.flatMap((p) => p.results) as c (c.id)}
    <li>{c.name}</li>
  {/each}
  {#if $scroll.hasNextPage}
    <li use:target>{$scroll.isFetchingNextPage ? 'Loading…' : ''}</li>
  {/if}
</ul>
```

```ts [Core]
import { createInfiniteScroll } from '@scrollstackjs/core'

const scroll = createInfiniteScroll({
  initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
  fetchPage: async ({ pageParam, signal }) => (await fetch(pageParam, { signal })).json(),
  getNextPageParam: (last) => last.info.next,
})

scroll.subscribe(() => render(scroll.getSnapshot()))
scroll.observeTarget(sentinelElement)
```

:::

That's a real, key-free API — the [live demo](/demo) runs exactly this against
[rickandmortyapi.com](https://rickandmortyapi.com), plus PokéAPI for offset
pagination and JSONPlaceholder for page numbers.

## Status

The core engine and the React, Vue, and Svelte adapters are built, typed, and
tested (45 tests) on a current toolchain. Inside this monorepo they resolve
through pnpm's `workspace:^` protocol, which is rewritten to a real semver range
at publish time. See [Getting started](/guide/getting-started) for install and
usage, and
[Architecture decisions](/decisions) for the reasoning behind the design.
