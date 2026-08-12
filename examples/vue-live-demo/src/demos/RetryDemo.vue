<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Failure handling. The toggle points the next fetch at a URL that really 404s,
 * so the engine retries twice on a short backoff (`failureCount` climbs while
 * `error` is still null) and only then gives up — with every loaded row intact.
 */
import { computed, ref } from 'vue'

import { BROKEN_CHARACTERS_URL, CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
import * as ui from '../ui'

const broken = ref(false)

const { state, target, retry, reset } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) =>
    fetchCharacters(broken.value ? BROKEN_CHARACTERS_URL : pageParam, signal),
  getNextPageParam: (last) => last.next,
  retry: 2,
  retryDelay: (count) => 400 * count,
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))
// An error, data already on screen, nothing in flight.
const loadMoreFailed = computed(
  () => state.value.error !== null && characters.value.length > 0 && !state.value.isFetching,
)
const retrying = computed(() => state.value.failureCount > 0 && state.value.error === null)
</script>

<template>
  <div :class="ui.card">
    <div :class="ui.bar">
      <span :class="ui.barTitle">
        <span class="size-2 rounded-full bg-amber-400 ring-4 ring-amber-400/15" /> Errors &amp;
        retry
      </span>
      <div class="flex flex-wrap items-center gap-3">
        <label
          class="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400 select-none"
        >
          <input v-model="broken" type="checkbox" class="accent-teal-500" />
          Break the next fetch (404)
        </label>
        <button type="button" :class="ui.btn" @click="reset()">Reset</button>
      </div>
    </div>

    <div :class="`${ui.scrollBox} h-60`">
      <div
        v-if="state.error !== null && characters.length === 0"
        class="flex flex-col items-center gap-3 p-6 text-center text-[13px] text-slate-400"
        role="alert"
      >
        <p>
          <code :class="ui.code">{{ String(state.error) }}</code> — nothing to show, so
          <code :class="ui.code">isError</code> is true.
        </p>
        <button type="button" :class="ui.btn" @click="retry()">Try again</button>
      </div>

      <ul>
        <li v-for="character in characters" :key="character.id" :class="ui.row">
          <img
            :src="character.image"
            :alt="character.name"
            loading="lazy"
            class="size-8 shrink-0 rounded-full bg-slate-800 object-cover"
          />
          <span class="text-[13.5px]">{{ character.name }}</span>
          <span class="ml-auto font-mono text-[11px] text-slate-600">#{{ character.id }}</span>
        </li>
      </ul>

      <div v-if="state.hasNextPage" :ref="target" :class="ui.sentinel">
        <template v-if="retrying">
          <span :class="ui.spinner" /> Retry {{ state.failureCount }} of 2…
        </template>
        <template v-else-if="state.isFetchingNextPage">
          <span :class="ui.spinner" /> Loading more…
        </template>
      </div>

      <p v-else-if="characters.length > 0" class="p-5 text-center text-[13px] text-slate-500">
        That’s all {{ characters.length }}.
      </p>
    </div>

    <div
      v-if="loadMoreFailed"
      class="flex flex-wrap items-center justify-center gap-3 border-t border-slate-800 bg-red-500/5 px-4 py-3 text-[13px] text-red-300"
      role="alert"
    >
      <span>
        Load-more failed — <code :class="ui.code">status</code> is still
        <code :class="ui.code">{{ state.status }}</code> and your {{ characters.length }} rows are
        untouched.
      </span>
      <button type="button" :class="ui.btn" @click="retry()">Retry</button>
    </div>
  </div>
</template>
