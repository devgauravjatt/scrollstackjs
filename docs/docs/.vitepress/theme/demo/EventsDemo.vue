<script setup lang="ts">
import type { ScrollStackPlugin } from '@scrollstackjs/core'
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Events and plugins, over JSONPlaceholder's page-number pagination. The log is
 * written by a *plugin* — a function that receives the engine, subscribes to its
 * lifecycle, and returns a cleanup that runs on `destroy()`. Plugins are
 * registered at creation, so nothing is missed.
 */
import { computed, ref } from 'vue'

import { POSTS_LIMIT, fetchPosts, type Post } from './api'

interface LogLine {
  readonly id: number
  readonly event: string
  readonly detail: string
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
  <div class="ss-demo">
    <div class="ss-bar">
      <span class="ss-bar__title">
        <span class="ss-dot" /> jsonplaceholder — events via a plugin
      </span>
      <div class="ss-bar__controls">
        <button
          type="button"
          class="ss-btn"
          :disabled="!state.hasNextPage || state.isFetching"
          @click="loadNextPage()"
        >
          Load a page
        </button>
        <button type="button" class="ss-btn" @click="reset()">Reset</button>
      </div>
    </div>

    <ol class="ss-log">
      <li v-if="log.length === 0" class="ss-log__empty">
        No events yet — load a page, then reset.
      </li>
      <li v-for="line in log" :key="line.id" class="ss-log__line">
        <code :class="['ss-tag', `ss-tag--${line.event}`]">{{ line.event }}</code>
        <span>{{ line.detail }}</span>
      </li>
    </ol>

    <div class="ss-footer">
      <span class="ss-footer__note">{{ count }} posts loaded into state</span>
    </div>
  </div>
</template>
