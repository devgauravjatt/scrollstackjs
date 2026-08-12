<script setup lang="ts">
import { LOADING_DELAY_MS } from './api'
import CancelDemo from './demos/CancelDemo.vue'
import EventsDemo from './demos/EventsDemo.vue'
/**
 * Every feature of the engine, running against free public APIs. The React and
 * Svelte apps next door render the same seven demos from the same core.
 */
import FeedDemo from './demos/FeedDemo.vue'
import ManualDemo from './demos/ManualDemo.vue'
import PaginationDemo from './demos/PaginationDemo.vue'
import RailDemo from './demos/RailDemo.vue'
import RetryDemo from './demos/RetryDemo.vue'

const sections = [
  {
    title: 'Auto-loading feed',
    blurb:
      'A sentinel rendered while hasNextPage is true, and the observer loading the next page when it scrolls into view. The panel is the live snapshot.',
  },
  {
    title: 'Errors & retry',
    blurb:
      'Flip the toggle and scroll: the next request 404s for real. The engine retries twice, then surfaces the error — and your loaded rows stay exactly where they were.',
  },
  {
    title: 'Manual pagination',
    blurb:
      'autoLoad: false takes the observer out of it. loadNextPage() no-ops while fetching or once exhausted, so a bare button needs no guard.',
  },
  {
    title: 'Horizontal rail',
    blurb:
      'Same engine, sideways. root is the rail element and rootMargin puts the trigger 240px before its right edge.',
  },
  {
    title: 'Pagination is one function',
    blurb: 'Three real APIs, three shapes, one interface. Only getNextPageParam differs.',
  },
  {
    title: 'Cancellation & stale results',
    blurb:
      'Start a fetch, then reset before it lands. The signal aborts, the late result is discarded, and failureCount stays 0 — an abort is a cancellation, not a failure.',
  },
  {
    title: 'Events, via a plugin',
    blurb:
      'The log is written by a plugin — a function that receives the engine, subscribes, and returns a cleanup that runs on destroy().',
  },
]
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-14">
    <header class="mb-12">
      <p class="mb-2 text-xs font-semibold tracking-[0.12em] text-teal-300 uppercase">
        @scrollstackjs/vue
      </p>
      <h1 class="text-4xl font-semibold tracking-tight">Live demo</h1>
      <p class="mt-3 max-w-2xl text-slate-400">
        Seven demos, one engine, no fake data. Fetches are slowed by
        <code class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-teal-300">
          {{ LOADING_DELAY_MS }}ms
        </code>
        in
        <code class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-teal-300">
          src/api.ts
        </code>
        so the loading states are actually visible — set it to 0 for real speed.
      </p>
    </header>

    <div class="space-y-14">
      <section>
        <h2 class="text-xl font-semibold tracking-tight">{{ sections[0]!.title }}</h2>
        <p class="mt-1.5 mb-4 max-w-3xl text-sm text-slate-400">{{ sections[0]!.blurb }}</p>
        <FeedDemo />
      </section>

      <section>
        <h2 class="text-xl font-semibold tracking-tight">{{ sections[1]!.title }}</h2>
        <p class="mt-1.5 mb-4 max-w-3xl text-sm text-slate-400">{{ sections[1]!.blurb }}</p>
        <RetryDemo />
      </section>

      <section>
        <h2 class="text-xl font-semibold tracking-tight">{{ sections[2]!.title }}</h2>
        <p class="mt-1.5 mb-4 max-w-3xl text-sm text-slate-400">{{ sections[2]!.blurb }}</p>
        <ManualDemo />
      </section>

      <section>
        <h2 class="text-xl font-semibold tracking-tight">{{ sections[3]!.title }}</h2>
        <p class="mt-1.5 mb-4 max-w-3xl text-sm text-slate-400">{{ sections[3]!.blurb }}</p>
        <RailDemo />
      </section>

      <section>
        <h2 class="text-xl font-semibold tracking-tight">{{ sections[4]!.title }}</h2>
        <p class="mt-1.5 mb-4 max-w-3xl text-sm text-slate-400">{{ sections[4]!.blurb }}</p>
        <PaginationDemo />
      </section>

      <section>
        <h2 class="text-xl font-semibold tracking-tight">{{ sections[5]!.title }}</h2>
        <p class="mt-1.5 mb-4 max-w-3xl text-sm text-slate-400">{{ sections[5]!.blurb }}</p>
        <CancelDemo />
      </section>

      <section>
        <h2 class="text-xl font-semibold tracking-tight">{{ sections[6]!.title }}</h2>
        <p class="mt-1.5 mb-4 max-w-3xl text-sm text-slate-400">{{ sections[6]!.blurb }}</p>
        <EventsDemo />
      </section>
    </div>

    <footer class="mt-16 border-t border-slate-800 pt-6 text-sm text-slate-500">
      Virtualization, persistence, pull-to-refresh, and bi-directional pagination are deliberately
      not built — see <code class="font-mono text-xs">DECISIONS.md</code> for why each lives outside
      the core.
    </footer>
  </main>
</template>
