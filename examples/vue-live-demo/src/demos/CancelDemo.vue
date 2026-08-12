<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Cancellation. Start a fetch, then reset before it lands: the signal aborts, the
 * late result is discarded by the generation counter, and `failureCount` stays 0
 * — an abort is a cancellation, not a failure.
 */
import { computed, ref } from 'vue'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
import * as ui from '../ui'

const started = ref(0)
const aborted = ref(0)
const landed = ref(0)

const { state, loadNextPage, reset } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: async ({ pageParam, signal }) => {
    started.value += 1
    try {
      const page = await fetchCharacters(pageParam, signal)
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

const counters = computed(() => [
  [started.value, 'fetches started'],
  [aborted.value, 'signals aborted'],
  [landed.value, 'responses kept'],
  [state.value.pages.length, 'pages in state'],
])

function clear(): void {
  reset()
  started.value = 0
  aborted.value = 0
  landed.value = 0
}
</script>

<template>
  <div :class="ui.card">
    <div :class="ui.bar">
      <span :class="ui.barTitle"> <span :class="ui.dot" /> Cancellation &amp; stale results </span>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" :class="ui.btn" :disabled="state.isFetching" @click="loadNextPage()">
          Fetch (slow)
        </button>
        <button type="button" :class="ui.btn" :disabled="!state.isFetching" @click="reset()">
          Reset mid-flight
        </button>
        <button type="button" :class="ui.btn" @click="clear()">Clear</button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-4">
      <div
        v-for="[value, label] in counters"
        :key="label"
        class="bg-slate-900/60 px-4 py-4 text-center"
      >
        <span class="block text-2xl font-semibold text-teal-300 tabular-nums">{{ value }}</span>
        <span class="mt-0.5 block text-[11.5px] text-slate-500">{{ label }}</span>
      </div>
    </div>

    <div :class="ui.footer">
      <span>
        status <code :class="ui.code">{{ state.status }}</code> · fetchStatus
        <code :class="ui.code">{{ state.fetchStatus }}</code> · failureCount
        <code :class="ui.code">{{ state.failureCount }}</code> · error
        <code :class="ui.code">{{ state.error === null ? 'null' : String(state.error) }}</code>
      </span>
    </div>
  </div>
</template>
