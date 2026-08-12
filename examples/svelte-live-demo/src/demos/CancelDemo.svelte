<script lang="ts">
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  /**
   * Cancellation. Start a fetch, then reset before it lands: the signal aborts,
   * the late result is discarded by the generation counter, and `failureCount`
   * stays 0 — an abort is a cancellation, not a failure.
   */
  import { onDestroy } from 'svelte'

  import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
  import * as ui from '../ui'

  let started = $state(0)
  let aborted = $state(0)
  let landed = $state(0)

  const scroll = createInfiniteScroll<CharacterPage, string>({
    initialPageParam: CHARACTERS_URL,
    fetchPage: async ({ pageParam, signal }) => {
      started += 1
      try {
        const page = await fetchCharacters(pageParam, signal)
        landed += 1
        return page
      } catch (error) {
        if (signal.aborted) aborted += 1
        throw error
      }
    },
    getNextPageParam: (last) => last.next,
    autoLoad: false,
    retry: 0,
  })
  const { loadNextPage, reset } = scroll
  onDestroy(scroll.destroy)

  const counters = $derived([
    [started, 'fetches started'],
    [aborted, 'signals aborted'],
    [landed, 'responses kept'],
    [$scroll.pages.length, 'pages in state'],
  ] as const)

  function clear(): void {
    reset()
    started = 0
    aborted = 0
    landed = 0
  }
</script>

<div class={ui.card}>
  <div class={ui.bar}>
    <span class={ui.barTitle}>
      <span class={ui.dot}></span> Cancellation &amp; stale results
    </span>
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class={ui.btn} disabled={$scroll.isFetching} onclick={loadNextPage}>
        Fetch (slow)
      </button>
      <button type="button" class={ui.btn} disabled={!$scroll.isFetching} onclick={reset}>
        Reset mid-flight
      </button>
      <button type="button" class={ui.btn} onclick={clear}>Clear</button>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-4">
    {#each counters as [value, label] (label)}
      <div class="bg-slate-900/60 px-4 py-4 text-center">
        <span class="block text-2xl font-semibold text-teal-300 tabular-nums">{value}</span>
        <span class="mt-0.5 block text-[11.5px] text-slate-500">{label}</span>
      </div>
    {/each}
  </div>

  <div class={ui.footer}>
    <span>
      status <code class={ui.code}>{$scroll.status}</code> · fetchStatus
      <code class={ui.code}>{$scroll.fetchStatus}</code> · failureCount
      <code class={ui.code}>{$scroll.failureCount}</code> · error
      <code class={ui.code}>{$scroll.error === null ? 'null' : String($scroll.error)}</code>
    </span>
  </div>
</div>
