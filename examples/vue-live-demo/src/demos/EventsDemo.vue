<script setup lang="ts">
import type { ScrollStackPlugin } from '@scrollstackjs/core'
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Events, through a *plugin*: a function that receives the engine, subscribes to
 * its lifecycle, and returns a cleanup that runs on `destroy()`. Plugins are
 * registered at creation, so they never miss the first `loadStart`.
 */
import { computed, ref } from 'vue'

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

const log = ref<LogLine[]>([])
let nextId = 0

function append(event: string, detail: string): void {
  log.value = [{ id: nextId++, event, detail }, ...log.value].slice(0, 8)
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

const { state, loadNextPage, reset } = useInfiniteScroll<readonly Post[], number>({
  initialPageParam: 1,
  fetchPage: ({ pageParam, signal }) => fetchPosts(pageParam, signal),
  getNextPageParam: (lastPage, _all, lastParam) =>
    lastPage.length === POSTS_LIMIT ? lastParam + 1 : null,
  autoLoad: false,
  plugins: [recorder],
})

const count = computed(() => state.value.pages.flat().length)
</script>

<template>
  <div :class="ui.card">
    <div :class="ui.bar">
      <span :class="ui.barTitle">
        <span :class="ui.dot" /> jsonplaceholder — events via a plugin
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :class="ui.btn"
          :disabled="!state.hasNextPage || state.isFetching"
          @click="loadNextPage()"
        >
          <span v-if="state.isFetching" :class="ui.spinner" />
          Load a page
        </button>
        <button type="button" :class="ui.btn" @click="reset()">Reset</button>
      </div>
    </div>

    <ol class="min-h-44 px-4 py-2 text-xs">
      <li v-if="log.length === 0" class="py-6 text-center text-slate-500">
        No events yet — load a page, then reset.
      </li>
      <li
        v-for="line in log"
        :key="line.id"
        class="flex items-baseline gap-3 border-b border-slate-800 py-1.5 text-slate-400"
      >
        <code
          class="min-w-[70px] rounded px-1.5 py-0.5 text-center text-[11px]"
          :class="TAG[line.event]"
        >
          {{ line.event }}
        </code>
        <span>{{ line.detail }}</span>
      </li>
    </ol>

    <div :class="ui.footer">
      <span>{{ count }} posts loaded into state</span>
    </div>
  </div>
</template>
