<script lang="ts">
  import type { ScrollStackPlugin } from '@scrollstackjs/core'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  /**
   * Events, through a *plugin*: a function that receives the engine, subscribes to
   * its lifecycle, and returns a cleanup that runs on `destroy()`. Plugins are
   * registered at creation, so they never miss the first `loadStart`.
   */
  import { onDestroy } from 'svelte'

  import { POSTS_LIMIT, fetchPosts, type Post } from '../api'
  import * as ui from '../ui'

  interface LogLine {
    readonly id: number
    readonly event: string
    readonly detail: string
  }

  const TAG: Record<string, string> = {
    loadStart: 'bg-slate-800 text-slate-300',
    success: 'bg-teal-400/15 text-teal-300',
    error: 'bg-red-400/15 text-red-300',
    reset: 'bg-amber-400/15 text-amber-300',
  }

  let log = $state<LogLine[]>([])
  let nextId = 0

  function append(event: string, detail: string): void {
    log = [{ id: nextId++, event, detail }, ...log].slice(0, 8)
  }

  const recorder: ScrollStackPlugin<readonly Post[], number> = (engine) => {
    const offs = [
      engine.on('loadStart', ({ pageParam }) => append('loadStart', `_page=${pageParam}`)),
      engine.on('success', ({ pageParam, pages }) =>
        append('success', `_page=${pageParam} · ${pages.length} page(s) held`),
      ),
      engine.on('error', ({ error }) => append('error', String(error))),
      engine.on('reset', () => append('reset', 'back to the initial state')),
    ]
    return () => offs.forEach((off) => off())
  }

  const scroll = createInfiniteScroll<readonly Post[], number>({
    initialPageParam: 1,
    fetchPage: ({ pageParam, signal }) => fetchPosts(pageParam, signal),
    getNextPageParam: (lastPage, _all, lastParam) =>
      lastPage.length === POSTS_LIMIT ? lastParam + 1 : null,
    autoLoad: false,
    plugins: [recorder],
  })
  const { loadNextPage, reset } = scroll
  onDestroy(scroll.destroy)

  const count = $derived($scroll.pages.flat().length)
</script>

<div class={ui.card}>
  <div class={ui.bar}>
    <span class={ui.barTitle}>
      <span class={ui.dot}></span> jsonplaceholder — events via a plugin
    </span>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class={ui.btn}
        disabled={!$scroll.hasNextPage || $scroll.isFetching}
        onclick={loadNextPage}
      >
        {#if $scroll.isFetching}<span class={ui.spinner}></span>{/if}
        Load a page
      </button>
      <button type="button" class={ui.btn} onclick={reset}>Reset</button>
    </div>
  </div>

  <ol class="min-h-44 px-4 py-2 text-xs">
    {#if log.length === 0}
      <li class="py-6 text-center text-slate-500">No events yet — load a page, then reset.</li>
    {/if}
    {#each log as line (line.id)}
      <li class="flex items-baseline gap-3 border-b border-slate-800 py-1.5 text-slate-400">
        <code class="min-w-[70px] rounded px-1.5 py-0.5 text-center text-[11px] {TAG[line.event]}">
          {line.event}
        </code>
        <span>{line.detail}</span>
      </li>
    {/each}
  </ol>

  <div class={ui.footer}>
    <span>{count} posts loaded into state</span>
  </div>
</div>
