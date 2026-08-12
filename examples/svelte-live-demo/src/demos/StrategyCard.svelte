<script lang="ts">
  import type { InfiniteScrollOptions } from '@scrollstackjs/core'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  import { onDestroy, untrack } from 'svelte'

  import * as ui from '../ui'

  const {
    label,
    source,
    code,
    options,
    truncate = 0,
  }: {
    label: string
    source: string
    code: string
    // The card is deliberately shape-agnostic — each instance is handed a
    // differently-typed engine (cursor, offset, page number).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: InfiniteScrollOptions<any, any>
    /** Cursor params are URLs — show only their tail. */
    truncate?: number
  } = $props()

  // `untrack`: options are read once, at creation — capturing the initial value
  // is the intent, not a missed reactive dependency.
  const scroll = createInfiniteScroll(untrack(() => options))
  const { loadNextPage, reset } = scroll
  onDestroy(scroll.destroy)

  // Key on the *untruncated* param: page params are unique per page, whereas two
  // long cursor URLs can share a tail once truncated for display.
  const shown = $derived(
    $scroll.pageParams.map((param) => {
      const key = String(param)
      const text = truncate > 0 && key.length > truncate ? `…${key.slice(-truncate)}` : key
      return { key, text }
    }),
  )
</script>

<div class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
  <p class="text-xs font-semibold tracking-wider text-teal-300 uppercase">
    {label}
    <span class="mt-0.5 block text-[10.5px] font-normal tracking-normal text-slate-500 normal-case">
      {source}
    </span>
  </p>

  <pre
    class="overflow-x-auto rounded-lg bg-slate-950 p-2.5 text-[11px] leading-relaxed text-slate-400"><code
      >{code}</code
    ></pre>

  <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
    <dt class="text-slate-500">pages</dt>
    <dd class="text-right font-mono text-[11.5px]">{$scroll.pages.length}</dd>
    <dt class="text-slate-500">hasNextPage</dt>
    <dd class="text-right font-mono text-[11.5px]">{$scroll.hasNextPage}</dd>
  </dl>

  <ol class="min-h-[72px] rounded-lg bg-slate-950 p-2.5 text-[11px]">
    {#if shown.length === 0}
      <li class="text-slate-600">no pages fetched yet</li>
    {/if}
    {#each shown as item (item.key)}
      <li class="font-mono break-all text-slate-400">{item.text}</li>
    {/each}
  </ol>

  {#if $scroll.error !== null}
    <p class="text-[11.5px] text-red-300">{String($scroll.error)}</p>
  {/if}

  <div class="mt-auto flex gap-2">
    <button
      type="button"
      class={ui.btn}
      disabled={!$scroll.hasNextPage || $scroll.isFetching}
      onclick={loadNextPage}
    >
      {#if $scroll.isFetching}<span class={ui.spinner}></span>{/if}
      Next page
    </button>
    <button type="button" class={ui.btn} onclick={reset}>Reset</button>
  </div>
</div>
