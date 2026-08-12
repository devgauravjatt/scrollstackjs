<script lang="ts">
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  /**
   * The baseline: a sentinel rendered while `hasNextPage` is true, plus a live
   * view of the snapshot. The page param is a *URL string* here — the API's
   * cursor is a whole link, and `getNextPageParam` returns whatever it hands back.
   */
  import { onDestroy } from 'svelte'

  import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
  import * as ui from '../ui'

  const scroll = createInfiniteScroll<CharacterPage, string>({
    initialPageParam: CHARACTERS_URL,
    fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal),
    getNextPageParam: (last) => last.next,
  })
  const { target, retry, reset } = scroll
  onDestroy(scroll.destroy)

  const characters = $derived($scroll.pages.flatMap((page) => page.results))

  const fields = $derived([
    ['status', $scroll.status],
    ['fetchStatus', $scroll.fetchStatus],
    ['pages', $scroll.pages.length],
    ['rows', characters.length],
    ['hasNextPage', String($scroll.hasNextPage)],
    ['failureCount', $scroll.failureCount],
  ] as const)

  const flags = $derived([
    ['isIdle', $scroll.isIdle],
    ['isLoading', $scroll.isLoading],
    ['isSuccess', $scroll.isSuccess],
    ['isError', $scroll.isError],
    ['isFetching', $scroll.isFetching],
    ['isFetchingNextPage', $scroll.isFetchingNextPage],
  ] as const)
</script>

<div class="{ui.card} grid lg:grid-cols-[minmax(0,1fr)_232px]">
  <div>
    <div class={ui.bar}>
      <span class={ui.barTitle}>
        <span class={ui.dot}></span> rickandmortyapi.com — cursor pagination
      </span>
      <button type="button" class={ui.btn} onclick={reset}>Reset</button>
    </div>

    <div class={ui.scrollBox}>
      {#if $scroll.isLoading}
        <ul>
          {#each { length: 6 } as _, i (i)}
            <li class={ui.row}>
              <span class="size-8 shrink-0 animate-pulse rounded-full bg-slate-800"></span>
              <span class="flex flex-1 flex-col gap-2">
                <span class="h-2.5 w-2/5 animate-pulse rounded bg-slate-800"></span>
                <span class="h-2.5 w-1/4 animate-pulse rounded bg-slate-800"></span>
              </span>
            </li>
          {/each}
        </ul>
      {:else if $scroll.isError}
        <div
          class="flex flex-col items-center gap-3 p-6 text-center text-[13px] text-slate-400"
          role="alert"
        >
          <p>Couldn’t reach the API — {String($scroll.error)}</p>
          <button type="button" class={ui.btn} onclick={retry}>Try again</button>
        </div>
      {:else}
        <ul>
          {#each characters as character (character.id)}
            <li class={ui.row}>
              <img
                src={character.image}
                alt={character.name}
                loading="lazy"
                class="size-8 shrink-0 rounded-full bg-slate-800 object-cover"
              />
              <span>
                <strong class="block text-[13.5px] font-medium">{character.name}</strong>
                <span class="block text-xs text-slate-500">
                  {character.species} · {character.status}
                </span>
              </span>
              <span class="ml-auto font-mono text-[11px] text-slate-600">#{character.id}</span>
            </li>
          {/each}
        </ul>
      {/if}

      <!-- Sentinel: scrolling it into view loads the next page. -->
      {#if $scroll.hasNextPage && !$scroll.isError}
        <div use:target class={ui.sentinel}>
          {#if $scroll.isFetchingNextPage}
            <span class={ui.spinner}></span> Loading more…
          {/if}
        </div>
      {:else if characters.length > 0}
        <p class="p-5 text-center text-[13px] text-slate-500">
          That’s all {characters.length} characters.
        </p>
      {/if}
    </div>
  </div>

  <aside class="border-t border-slate-800 bg-slate-900 p-4 lg:border-t-0 lg:border-l">
    <p class="mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
      Live snapshot
    </p>
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {#each fields as [label, value] (label)}
        <dt class="text-slate-500">{label}</dt>
        <dd class="text-right font-mono text-[11.5px] text-slate-300">{value}</dd>
      {/each}
    </dl>

    <p class="mt-4 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
      Derived
    </p>
    <ul class="flex flex-wrap gap-1.5">
      {#each flags as [name, on] (name)}
        <li
          class="rounded-full border px-2 py-0.5 font-mono text-[10.5px] {on
            ? 'border-teal-400 bg-teal-400 text-teal-950'
            : 'border-slate-800 text-slate-600'}"
        >
          {name}
        </li>
      {/each}
    </ul>
  </aside>
</div>
