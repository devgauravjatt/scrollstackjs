---
layout: home

hero:
  name: ScrollStack Js
  text: Headless infinite scrolling library for JavaScript
  tagline: One tiny engine — pagination, retry, cancellation, observers. You bring the markup.
  image:
    src: /logo.png
    alt: ScrollStack
  actions:
    - theme: brand
      text: Start the tutorial
      link: /tutorial
    - theme: alt
      text: Live demo
      link: /demo
    - theme: alt
      text: GitHub
      link: https://github.com/devgauravjatt/scrollstackjs

features:
  # Icons are inline SVG: VPFeature renders a string `icon` with `v-html`. They use
  # `currentColor` with the brand tint set via inline style, so they follow the theme.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><path d="M12 2.75 3.25 7.5v9L12 21.25l8.75-4.75v-9L12 2.75Z"/><path d="M3.25 7.5 12 12.25l8.75-4.75"/><path d="M12 12.25v9"/></svg>'
    title: 1.92 KB gzipped
    details: The core engine has zero runtime dependencies. The React adapter adds 0.32 KB — adapters are thin bindings, not second implementations.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><circle cx="12" cy="12" r="2.75"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="20" r="2"/><path d="m6.45 6.45 3.6 3.6M17.55 6.45l-3.6 3.6M12 14.75V18"/></svg>'
    title: Framework-agnostic
    details: React, Vue, and Svelte adapters ship today, each binding the same two methods — subscribe and getSnapshot. Adding another is mechanical.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><path d="M3.5 6h11M3.5 11h11M3.5 16h7"/><path d="M19 8.5v9m0 0 2.75-2.75M19 17.5l-2.75-2.75"/></svg>'
    title: Pagination is one function
    details: Cursor, offset, and page-number pagination are different getNextPageParam implementations, not different APIs.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><path d="M12 2.75 4.5 5.75v6.1c0 4.3 3.1 7.8 7.5 9.4 4.4-1.6 7.5-5.1 7.5-9.4v-6.1L12 2.75Z"/><path d="m8.9 12.1 2.3 2.3 4.4-4.6"/></svg>'
    title: Correct under concurrency
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
