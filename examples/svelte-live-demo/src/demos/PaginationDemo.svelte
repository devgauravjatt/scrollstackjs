<script lang="ts">
  import {
    CHARACTERS_URL,
    POKEMON_LIMIT,
    POSTS_LIMIT,
    fetchCharacters,
    fetchPokemon,
    fetchPosts,
  } from '../api'
  /**
   * Three real APIs, three pagination shapes, one engine. Nothing differs except
   * `getNextPageParam` — there is no strategy switch inside the engine to flip.
   */
  import StrategyCard from './StrategyCard.svelte'

  const cursor = {
    initialPageParam: CHARACTERS_URL,
    fetchPage: ({ pageParam, signal }: { pageParam: string; signal: AbortSignal }) =>
      fetchCharacters(pageParam, signal),
    getNextPageParam: (last: { next: string | null }) => last.next,
  }

  const offset = {
    initialPageParam: 0,
    fetchPage: ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) =>
      fetchPokemon(pageParam, signal),
    getNextPageParam: (page: readonly unknown[], _all: unknown, param: number) =>
      page.length === POKEMON_LIMIT ? param + POKEMON_LIMIT : null,
  }

  const paged = {
    initialPageParam: 1,
    fetchPage: ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) =>
      fetchPosts(pageParam, signal),
    getNextPageParam: (page: readonly unknown[], _all: unknown, param: number) =>
      page.length === POSTS_LIMIT ? param + 1 : null,
  }
</script>

<div class="grid gap-4 md:grid-cols-3">
  <StrategyCard
    label="Cursor"
    source="rickandmortyapi.com"
    code="getNextPageParam: (last) => last.next"
    options={cursor}
    truncate={34}
  />
  <StrategyCard
    label="Offset / limit"
    source="pokeapi.co"
    code={`getNextPageParam: (page, _all, param) =>\n  page.length === LIMIT ? param + LIMIT : null`}
    options={offset}
  />
  <StrategyCard
    label="Page number"
    source="jsonplaceholder.typicode.com"
    code={`getNextPageParam: (page, _all, param) =>\n  page.length === LIMIT ? param + 1 : null`}
    options={paged}
  />
</div>
