<script lang="ts">
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  /**
   * Failure handling. The toggle points the next fetch at a URL that really 404s,
   * so the engine retries twice on a short backoff (`failureCount` climbs while
   * `error` is still null) and only then gives up — with every loaded row intact.
   */
  import { onDestroy } from 'svelte'

  import {
    BROKEN_CHARACTERS_URL,
    CHARACTERS_URL,
    fetchCharacters,
    type CharacterPage,
  } from '../api'
  import * as ui from '../ui'

  let broken = $state(false)

  const scroll = createInfiniteScroll<CharacterPage, string>({
    initialPageParam: CHARACTERS_URL,
    fetchPage: ({ pageParam, signal }) =>
      fetchCharacters(broken ? BROKEN_CHARACTERS_URL : pageParam, signal),
    getNextPageParam: (last) => last.next,
    retry: 2,
    retryDelay: (count) => 400 * count,
  })
  const { target, retry, reset } = scroll
  onDestroy(scroll.destroy)

  const characters = $derived($scroll.pages.flatMap((page) => page.results))
  // An error, data already on screen, nothing in flight.
  const loadMoreFailed = $derived(
    $scroll.error !== null && characters.length > 0 && !$scroll.isFetching,
  )
  const retrying = $derived($scroll.failureCount > 0 && $scroll.error === null)
</script>

<div class={ui.card}>
  <div class={ui.bar}>
    <span class={ui.barTitle}>
      <span class="size-2 rounded-full bg-amber-400 ring-4 ring-amber-400/15"></span> Errors &amp; retry
    </span>
    <div class="flex flex-wrap items-center gap-3">
      <label
        class="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400 select-none"
      >
        <input type="checkbox" bind:checked={broken} class="accent-teal-500" />
        Break the next fetch (404)
      </label>
      <button type="button" class={ui.btn} onclick={reset}>Reset</button>
    </div>
  </div>

  <div class="{ui.scrollBox} h-60">
    {#if $scroll.error !== null && characters.length === 0}
      <div
        class="flex flex-col items-center gap-3 p-6 text-center text-[13px] text-slate-400"
        role="alert"
      >
        <p>
          <code class={ui.code}>{String($scroll.error)}</code> — nothing to show, so
          <code class={ui.code}>isError</code> is true.
        </p>
        <button type="button" class={ui.btn} onclick={retry}>Try again</button>
      </div>
    {/if}

    <ul>
      {#each characters as character (character.id)}
        <li class={ui.row}>
          <img
            src={character.image}
            alt={character.name}
            loading="lazy"
            class="size-8 shrink-0 rounded-full bg-slate-800 object-cover"
          />
          <span class="text-[13.5px]">{character.name}</span>
          <span class="ml-auto font-mono text-[11px] text-slate-600">#{character.id}</span>
        </li>
      {/each}
    </ul>

    {#if $scroll.hasNextPage}
      <div use:target class={ui.sentinel}>
        {#if retrying}
          <span class={ui.spinner}></span> Retry {$scroll.failureCount} of 2…
        {:else if $scroll.isFetchingNextPage}
          <span class={ui.spinner}></span> Loading more…
        {/if}
      </div>
    {:else if characters.length > 0}
      <p class="p-5 text-center text-[13px] text-slate-500">That’s all {characters.length}.</p>
    {/if}
  </div>

  {#if loadMoreFailed}
    <div
      class="flex flex-wrap items-center justify-center gap-3 border-t border-slate-800 bg-red-500/5 px-4 py-3 text-[13px] text-red-300"
      role="alert"
    >
      <span>
        Load-more failed — <code class={ui.code}>status</code> is still
        <code class={ui.code}>{$scroll.status}</code> and your {characters.length} rows are untouched.
      </span>
      <button type="button" class={ui.btn} onclick={retry}>Retry</button>
    </div>
  {/if}
</div>
