<script lang="ts">
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  /**
   * `autoLoad: false` keeps the observer out of it entirely — the PokéAPI
   * paginates by offset and a button drives it. `loadNextPage()` no-ops while a
   * fetch is in flight or once `hasNextPage` is false, so `disabled` is cosmetic.
   */
  import { onDestroy } from 'svelte'

  import { POKEMON_LIMIT, fetchPokemon, pokemonSprite, type Pokemon } from '../api'
  import * as ui from '../ui'

  const scroll = createInfiniteScroll<readonly Pokemon[], number>({
    initialPageParam: 0,
    fetchPage: ({ pageParam, signal }) => fetchPokemon(pageParam, signal),
    // A short page means the end — otherwise advance by the limit.
    getNextPageParam: (lastPage, _all, lastParam) =>
      lastPage.length === POKEMON_LIMIT ? lastParam + POKEMON_LIMIT : null,
    autoLoad: false,
  })
  const { loadNextPage, reset } = scroll
  onDestroy(scroll.destroy)

  const pokemon = $derived($scroll.pages.flat())
</script>

<div class={ui.card}>
  <div class={ui.bar}>
    <span class={ui.barTitle}>
      <span class={ui.dot}></span> pokeapi.co — offset,
      <code class={ui.code}>autoLoad: false</code>
    </span>
    <button type="button" class={ui.btn} onclick={reset}>Reset</button>
  </div>

  <div class="{ui.scrollBox} h-60">
    {#if $scroll.isIdle}
      <p class="p-5 text-center text-[13px] text-slate-500">
        Nothing fetched yet — press the button.
      </p>
    {/if}

    {#if $scroll.isError}
      <p class="p-5 text-center text-[13px] text-red-300" role="alert">{String($scroll.error)}</p>
    {/if}

    <ul>
      {#each pokemon as item, index (item.name)}
        <li class={ui.row}>
          <img
            src={pokemonSprite(item.url)}
            alt={item.name}
            loading="lazy"
            class="size-8 shrink-0 rounded-full bg-slate-800 object-contain [image-rendering:pixelated]"
          />
          <span>
            <strong class="block text-[13.5px] font-medium capitalize">{item.name}</strong>
            <span class="block text-xs text-slate-500">offset {index}</span>
          </span>
        </li>
      {/each}
    </ul>
  </div>

  <div class={ui.footer}>
    <button
      type="button"
      class={ui.btnPrimary}
      disabled={!$scroll.hasNextPage || $scroll.isFetching}
      onclick={loadNextPage}
    >
      {#if $scroll.isFetching}<span class={ui.spinner}></span>{/if}
      {$scroll.hasNextPage ? 'Load next page' : 'No more pages'}
    </button>
    <span>{$scroll.pages.length} page(s) · params [{$scroll.pageParams.join(', ')}]</span>
  </div>
</div>
