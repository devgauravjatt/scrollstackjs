---
layout: home

hero:
  name: ScrollStack Js
  text: Infinite scrolling, without the markup
  tagline: Three options in, a snapshot out. It handles paging, retries, cancellation and the scroll trigger — you write the HTML.
  image:
    src: /logo.png
    alt: ScrollStack
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Examples
      link: /examples/
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
    title: 1.9 KB, no dependencies
    details: The whole engine. Your framework adapter adds about 0.3 KB on top.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><circle cx="12" cy="12" r="2.75"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="20" r="2"/><path d="m6.45 6.45 3.6 3.6M17.55 6.45l-3.6 3.6M12 14.75V18"/></svg>'
    title: React, Vue, Svelte — or none
    details: Same options, same result. Only the two lines that bind it to your framework change.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><path d="M3.5 6h11M3.5 11h11M3.5 16h7"/><path d="M19 8.5v9m0 0 2.75-2.75M19 17.5l-2.75-2.75"/></svg>'
    title: Any API shape
    details: Cursor, offset, page numbers — you write one small function that says where the next page is.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><path d="M12 2.75 4.5 5.75v6.1c0 4.3 3.1 7.8 7.5 9.4 4.4-1.6 7.5-5.1 7.5-9.4v-6.1L12 2.75Z"/><path d="m8.9 12.1 2.3 2.3 4.4-4.6"/></svg>'
    title: Nothing lands twice
    details: Retries with backoff, cancels what you abandon, and never lets an old response overwrite a fresh list.
---

## Install

```bash
npm i @scrollstackjs/react     # or /vue, /svelte, or /core on its own
```

## Copy this

A real, working feed. The API is free and needs no key, so you can paste this and
run it right now.

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

      {/* Scroll this into view and the next page loads. */}
      {hasNextPage && <li ref={ref}>{isFetchingNextPage ? 'Loading…' : ''}</li>}
    </ul>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

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

    <!-- Scroll this into view and the next page loads. -->
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
    fetchPage: async ({ pageParam, signal }) => (await fetch(pageParam, { signal })).json(),
    getNextPageParam: (last) => last.info.next, // null = no more pages
  })
  const { target } = scroll
  onDestroy(scroll.destroy)
</script>

<ul>
  {#each $scroll.pages.flatMap((p) => p.results) as c (c.id)}
    <li>{c.name}</li>
  {/each}

  <!-- Scroll this into view and the next page loads. -->
  {#if $scroll.hasNextPage}
    <li use:target>{$scroll.isFetchingNextPage ? 'Loading…' : ''}</li>
  {/if}
</ul>
```

```ts [No framework]
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

## The three options

That is the whole required API:

| Option             | What it is                                                           |
| ------------------ | -------------------------------------------------------------------- |
| `initialPageParam` | What to fetch first — a URL, a cursor, `0`, whatever your API wants. |
| `fetchPage`        | How to fetch one page. Gets the param and an `AbortSignal`.          |
| `getNextPageParam` | Where the next page is. Return `null` when there are no more.        |

Everything else — `pages`, `hasNextPage`, `isLoading`, retries, cancellation — you
get back for free.

## Where to next

- **[Get started](/guide/getting-started)** — install, the full snapshot, and the
  one rule about sentinels.
- **[Examples](/examples/)** — nine running demos, each with the code in all four
  flavors: paging, retries, virtual lists, devtools and more.
- **[Live demo](/demo)** — play with the behavior first, read later.
