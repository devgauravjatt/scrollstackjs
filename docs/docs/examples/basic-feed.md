# Basic feed

The arrangement almost every infinite list wants: rows, and a sentinel element
rendered after them while `hasNextPage` is true. When the sentinel scrolls into
view, the next page loads.

The API here is [Rick and Morty](https://rickandmortyapi.com), whose `info.next`
is a **full URL** — so the page param is a string, not a number. That is the whole
of the "cursor" strategy: return whatever the API gave you.

<FeedDemo />

## The code

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'

interface Character {
  id: number
  name: string
  species: string
}

interface Page {
  results: Character[]
  info: { next: string | null }
}

export function Feed() {
  const { pages, ref, isLoading, isError, error, hasNextPage, isFetchingNextPage, retry } =
    useInfiniteScroll<Page, string>({
      initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
      fetchPage: async ({ pageParam, signal }) => {
        const response = await fetch(pageParam, { signal })
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        return response.json()
      },
      // `null` here is what flips `hasNextPage` to false.
      getNextPageParam: (last) => last.info.next,
    })

  const characters = pages.flatMap((page) => page.results)

  if (isLoading) return <p>Loading…</p>
  if (isError) return <button onClick={retry}>Retry — {String(error)}</button>

  return (
    <ul>
      {characters.map((character) => (
        <li key={character.id}>
          {character.name} — {character.species}
        </li>
      ))}

      {/* The sentinel. Rendering it only while there is a next page is what
          stops the observer from firing at the end of the list. */}
      {hasNextPage && <li ref={ref}>{isFetchingNextPage ? 'Loading more…' : ''}</li>}
    </ul>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

interface Character {
  id: number
  name: string
  species: string
}

interface Page {
  results: Character[]
  info: { next: string | null }
}

const { state, target, retry } = useInfiniteScroll<Page, string>({
  initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
  fetchPage: async ({ pageParam, signal }) => {
    const response = await fetch(pageParam, { signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return response.json()
  },
  getNextPageParam: (last) => last.info.next,
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))
</script>

<template>
  <p v-if="state.isLoading">Loading…</p>
  <button v-else-if="state.isError" @click="retry()">Retry — {{ String(state.error) }}</button>

  <ul v-else>
    <li v-for="character in characters" :key="character.id">
      {{ character.name }} — {{ character.species }}
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

  interface Character {
    id: number
    name: string
    species: string
  }

  interface Page {
    results: Character[]
    info: { next: string | null }
  }

  const scroll = createInfiniteScroll<Page, string>({
    initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
    fetchPage: async ({ pageParam, signal }) => {
      const response = await fetch(pageParam, { signal })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return response.json()
    },
    getNextPageParam: (last) => last.info.next,
  })

  const { target, retry } = scroll
  onDestroy(scroll.destroy)

  // `$scroll` is the snapshot — the store contract, nothing extra to learn.
  $: characters = $scroll.pages.flatMap((page) => page.results)
</script>

{#if $scroll.isLoading}
  <p>Loading…</p>
{:else if $scroll.isError}
  <button on:click={retry}>Retry — {String($scroll.error)}</button>
{:else}
  <ul>
    {#each characters as character (character.id)}
      <li>{character.name} — {character.species}</li>
    {/each}

    {#if $scroll.hasNextPage}
      <li use:target>{$scroll.isFetchingNextPage ? 'Loading more…' : ''}</li>
    {/if}
  </ul>
{/if}
```

```ts [Vanilla]
import { createInfiniteScroll } from '@scrollstackjs/core'

const list = document.querySelector('#list')!
const sentinel = document.querySelector('#sentinel')!

const scroll = createInfiniteScroll({
  initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
  fetchPage: async ({ pageParam, signal }) => {
    const response = await fetch(pageParam, { signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return response.json()
  },
  getNextPageParam: (last) => last.info.next,
})

scroll.subscribe(() => {
  const { pages, hasNextPage, isFetchingNextPage } = scroll.getSnapshot()
  list.innerHTML = pages
    .flatMap((page) => page.results)
    .map((character) => `<li>${character.name} — ${character.species}</li>`)
    .join('')
  sentinel.hidden = !hasNextPage
  sentinel.textContent = isFetchingNextPage ? 'Loading more…' : ''
})

scroll.observeTarget(sentinel)
```

:::

## Three things worth noticing

**The sentinel is conditional.** Rendering it only while `hasNextPage` is true is
what stops the observer at the end of the list. Leave it mounted and it keeps
intersecting; the engine no-ops, but you have made it do so on every scroll.

**`fetch` does not throw on a 404.** Without the `response.ok` check, an error
page is stored as data and the list quietly fills with nothing. Every example on
this site checks it for that reason.

**The signal is not decoration.** Forwarding `signal` to `fetch` is what makes
`reset()` and unmount cancel real network work — see
[Cancellation](/examples/cancellation).

> **Reference →** [`@scrollstackjs/core`](/api/core) for the full snapshot, or the
> [Tutorial](/tutorial) if you would rather build this up step by step.
