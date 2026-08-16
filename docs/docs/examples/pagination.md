# Pagination strategies

Cursor, offset, and page-number pagination are not three features. They are three
implementations of one function, `getNextPageParam`, against the same engine
The demo below runs all three at once, against three different APIs.

<PaginationDemo />

## The only line that changes

```ts
// Cursor — the API hands you the next pointer. Rick and Morty returns a full URL.
getNextPageParam: (last) => last.info.next

// Offset — count what you have. `allPages` is right there for it.
getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length * LIMIT)

// Page number — the same idea, one-indexed.
getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length + 1)
```

Return `null` or `undefined` to say the list is finished; that is what flips
`hasNextPage` to `false`. Anything else becomes the next `pageParam`.

::: warning `0` is a valid page param
The engine checks `== null`, never truthiness — an offset of `0` and an empty
string are real values, not "no more pages". If you write your own end condition,
do the same.
:::

## Offset pagination, end to end

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'

const LIMIT = 10

interface Pokemon {
  name: string
  url: string
}

export function PokemonList() {
  const { pages, ref, hasNextPage, isFetchingNextPage } = useInfiniteScroll<Pokemon[], number>({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) => {
      const response = await fetch(
        `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=${LIMIT}`,
        { signal },
      )
      if (!response.ok) throw new Error(`${response.status}`)
      return (await response.json()).results
    },
    // A short page means the API ran out — that is the end condition.
    getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length * LIMIT),
  })

  return (
    <ul>
      {pages.flat().map((pokemon) => (
        <li key={pokemon.name}>{pokemon.name}</li>
      ))}
      {hasNextPage && <li ref={ref}>{isFetchingNextPage ? 'Loading…' : ''}</li>}
    </ul>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

const LIMIT = 10

interface Pokemon {
  name: string
  url: string
}

const { state, target } = useInfiniteScroll<Pokemon[], number>({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) => {
    const response = await fetch(
      `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=${LIMIT}`,
      { signal },
    )
    if (!response.ok) throw new Error(`${response.status}`)
    return (await response.json()).results
  },
  getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length * LIMIT),
})

const pokemon = computed(() => state.value.pages.flat())
</script>

<template>
  <ul>
    <li v-for="item in pokemon" :key="item.name">{{ item.name }}</li>
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

  const LIMIT = 10

  interface Pokemon {
    name: string
    url: string
  }

  const scroll = createInfiniteScroll<Pokemon[], number>({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) => {
      const response = await fetch(
        `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=${LIMIT}`,
        { signal },
      )
      if (!response.ok) throw new Error(`${response.status}`)
      return (await response.json()).results
    },
    getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length * LIMIT),
  })

  const { target } = scroll
  onDestroy(scroll.destroy)
</script>

<ul>
  {#each $scroll.pages.flat() as item (item.name)}
    <li>{item.name}</li>
  {/each}
  {#if $scroll.hasNextPage}
    <li use:target>{$scroll.isFetchingNextPage ? 'Loading…' : ''}</li>
  {/if}
</ul>
```

```ts [Vanilla]
import { createInfiniteScroll } from '@scrollstackjs/core'

const LIMIT = 10

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) => {
    const response = await fetch(
      `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=${LIMIT}`,
      { signal },
    )
    if (!response.ok) throw new Error(`${response.status}`)
    return (await response.json()).results
  },
  getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length * LIMIT),
})

scroll.subscribe(() => render(scroll.getSnapshot()))
scroll.observeTarget(document.querySelector('#sentinel')!)
```

:::

## Pages, not items

`pages` is an array of whatever `fetchPage` returned — the engine never looks
inside it. Flattening is yours to do, which is why every example ends up with a
`pages.flatMap(...)` or `pages.flat()` somewhere.

That is deliberate: a page often carries more than rows (a total count, a
timestamp, a facet list), and an engine that flattened for you would throw it
away.

> **Next →** [Pagination guide](/guide/pagination) for time-based and
> bidirectional shapes.
