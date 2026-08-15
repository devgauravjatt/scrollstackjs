# Manual controls

The sentinel is a convenience, not a requirement. `loadNextPage()` is the same
call the observer makes, so a "Load more" button and an auto-loading feed are the
same engine with a different trigger — and they can coexist without racing.

<ManualDemo />

## A button instead of a sentinel

Set `autoLoad: false` and the observer stops loading on intersection, leaving the
button as the only way forward.

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'

export function Feed() {
  const { pages, loadNextPage, reset, hasNextPage, isFetching, isFetchingNextPage } =
    useInfiniteScroll({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.nextCursor,
      autoLoad: false, // no sentinel behavior at all
    })

  return (
    <>
      <ul>
        {pages
          .flatMap((page) => page.items)
          .map((item) => (
            <Row key={item.id} {...item} />
          ))}
      </ul>

      {/* `disabled` is cosmetic — loadNextPage() no-ops while fetching or at the end. */}
      <button onClick={() => loadNextPage()} disabled={!hasNextPage || isFetching}>
        {isFetchingNextPage ? 'Loading…' : hasNextPage ? 'Load more' : 'That’s everything'}
      </button>

      <button onClick={reset}>Start over</button>
    </>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

const { state, loadNextPage, reset } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  autoLoad: false,
})

const items = computed(() => state.value.pages.flatMap((page) => page.items))
</script>

<template>
  <ul>
    <Row v-for="item in items" :key="item.id" v-bind="item" />
  </ul>

  <button :disabled="!state.hasNextPage || state.isFetching" @click="loadNextPage()">
    {{
      state.isFetchingNextPage ? 'Loading…' : state.hasNextPage ? 'Load more' : 'That’s everything'
    }}
  </button>

  <button @click="reset()">Start over</button>
</template>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
    autoLoad: false,
  })

  const { loadNextPage, reset } = scroll
  onDestroy(scroll.destroy)
</script>

<ul>
  {#each $scroll.pages.flatMap((page) => page.items) as item (item.id)}
    <Row {...item} />
  {/each}
</ul>

<button disabled={!$scroll.hasNextPage || $scroll.isFetching} on:click={loadNextPage}>
  {$scroll.isFetchingNextPage ? 'Loading…' : $scroll.hasNextPage ? 'Load more' : 'That’s everything'}
</button>

<button on:click={reset}>Start over</button>
```

```ts [Vanilla]
import { createInfiniteScroll } from '@scrollstackjs/core'

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  autoLoad: false,
})

button.addEventListener('click', () => scroll.loadNextPage())
resetButton.addEventListener('click', () => scroll.reset())

scroll.subscribe(() => {
  const { hasNextPage, isFetching, isFetchingNextPage } = scroll.getSnapshot()
  button.disabled = !hasNextPage || isFetching
  button.textContent = isFetchingNextPage ? 'Loading…' : 'Load more'
})
```

:::

## Both at once

Leave `autoLoad` on (the default) and keep the button: the sentinel loads while
scrolling, and the button loads on demand. They cannot double-fetch, because
`loadNextPage()` returns immediately when a request is already in flight or
`hasNextPage` is false. No guard of your own is needed.

```ts
// Both of these are safe to call at any time, from anywhere.
await scroll.loadNextPage() // no-op while fetching, or at the end of the list
scroll.reset() // aborts in flight work and returns to the initial state
```

## What `reset()` actually does

It bumps the engine's generation counter, aborts the in-flight request through its
`AbortSignal`, clears the retry timer, and returns to the initial snapshot. A
response that was already on its way lands into a generation that no longer
matches and is discarded, so it cannot resurrect the list you just cleared
(ADR-005).

That makes `reset()` the right call when the _inputs_ change — a new search query,
a switched filter — because adapter options are read once, at mount.

> **Reference →** [`loadNextPage` / `reset`](/api/core) and
> [Cancellation](/examples/cancellation) for what happens to the request in flight.
