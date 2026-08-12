<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Cancellation. This hits the real API but holds the result for 2.5s afterwards
 * so you can catch it mid-flight. Reset before it lands and watch what does *not*
 * happen: no page is appended, `failureCount` stays 0, and no error is surfaced —
 * an abort is a cancellation, not a failure.
 */
import { ref } from 'vue'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from './api'

const started = ref(0)
const aborted = ref(0)
const landed = ref(0)

/** Resolves after `ms`, or rejects the moment the signal aborts. */
function linger(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

const { state, loadNextPage, reset } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: async ({ pageParam, signal }) => {
    started.value += 1
    try {
      const page = await fetchCharacters(pageParam, signal)
      await linger(2500, signal)
      landed.value += 1
      return page
    } catch (error) {
      if (signal.aborted) aborted.value += 1
      throw error
    }
  },
  getNextPageParam: (last) => last.next,
  autoLoad: false,
  retry: 0,
})

function clear(): void {
  reset()
  started.value = 0
  aborted.value = 0
  landed.value = 0
}
</script>

<template>
  <div class="ss-demo">
    <div class="ss-bar">
      <span class="ss-bar__title"> <span class="ss-dot" /> Cancellation &amp; stale results </span>
      <div class="ss-bar__controls">
        <button type="button" class="ss-btn" :disabled="state.isFetching" @click="loadNextPage()">
          Fetch (held 2.5s)
        </button>
        <button type="button" class="ss-btn" :disabled="!state.isFetching" @click="reset()">
          Reset mid-flight
        </button>
        <button type="button" class="ss-btn" @click="clear()">Clear</button>
      </div>
    </div>

    <div class="ss-counters">
      <div class="ss-counter">
        <span class="ss-counter__n">{{ started }}</span>
        <span class="ss-counter__l">fetches started</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{ aborted }}</span>
        <span class="ss-counter__l">signals aborted</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{ landed }}</span>
        <span class="ss-counter__l">responses kept</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{ state.pages.length }}</span>
        <span class="ss-counter__l">pages in state</span>
      </div>
    </div>

    <div class="ss-footer">
      <span class="ss-footer__note">
        status <code>{{ state.status }}</code> · fetchStatus <code>{{ state.fetchStatus }}</code> ·
        failureCount <code>{{ state.failureCount }}</code> · error
        <code>{{ state.error === null ? 'null' : String(state.error) }}</code>
      </span>
    </div>
  </div>
</template>
