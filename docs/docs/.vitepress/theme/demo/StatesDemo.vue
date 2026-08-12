<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Step 3: the five branches you actually render. The ribbon highlights whichever
 * one is live right now — scroll, and flip the toggle to reach the error branch.
 */
import { computed, ref } from 'vue'

import { BROKEN_CHARACTERS_URL, CHARACTERS_URL, fetchCharacters, type CharacterPage } from './api'

const broken = ref(false)

const { state, target, retry, reset } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) =>
    fetchCharacters(broken.value ? BROKEN_CHARACTERS_URL : pageParam, signal, 700),
  getNextPageParam: (last) => last.next,
  retry: 0,
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))
const firstLoadFailed = computed(() => state.value.isError)
const loadMoreFailed = computed(
  () => state.value.error !== null && characters.value.length > 0 && !state.value.isFetching,
)
const done = computed(() => !state.value.hasNextPage && characters.value.length > 0)

/** Exactly one of these is the branch currently on screen. */
const active = computed(() => {
  if (state.value.isLoading) return 'first-load'
  if (firstLoadFailed.value) return 'first-load error'
  if (loadMoreFailed.value) return 'load-more error'
  if (state.value.isFetchingNextPage) return 'loading more'
  if (done.value) return 'end of list'
  return 'rows'
})

const branches = [
  'first-load',
  'rows',
  'loading more',
  'load-more error',
  'first-load error',
  'end of list',
]
</script>

<template>
  <div class="ss-demo">
    <div class="ss-bar">
      <ul class="ss-branches">
        <li
          v-for="branch in branches"
          :key="branch"
          :class="['ss-branch', branch === active && 'ss-branch--on']"
        >
          {{ branch }}
        </li>
      </ul>
      <div class="ss-bar__controls">
        <label class="ss-toggle">
          <input v-model="broken" type="checkbox" />
          Break it
        </label>
        <button type="button" class="ss-btn" @click="reset()">Reset</button>
      </div>
    </div>

    <div class="ss-box ss-box--short">
      <!-- 1. first load: no data yet -->
      <p v-if="state.isLoading" class="ss-end">Loading…</p>

      <!-- 2. first-load error: nothing usable to show -->
      <div v-else-if="firstLoadFailed" class="ss-state" role="alert">
        <p>{{ String(state.error) }}</p>
        <button type="button" class="ss-btn" @click="retry()">Try again</button>
      </div>

      <!-- 3. rows -->
      <ul v-else class="ss-list">
        <li v-for="character in characters" :key="character.id" class="ss-row">
          <img class="ss-avatar" :src="character.image" :alt="character.name" loading="lazy" />
          <span class="ss-row__name">{{ character.name }}</span>
        </li>
      </ul>

      <!-- 4. loading more (the sentinel doubles as the indicator) -->
      <div v-if="state.hasNextPage && !firstLoadFailed" :ref="target" class="ss-sentinel">
        <template v-if="state.isFetchingNextPage"
          ><span class="ss-spinner" /> Loading more…</template
        >
      </div>

      <!-- 6. end of list -->
      <p v-else-if="done" class="ss-end">That’s all {{ characters.length }}.</p>
    </div>

    <!-- 5. load-more error: the rows above are still valid -->
    <div v-if="loadMoreFailed" class="ss-alert" role="alert">
      <span>Failed to load more — {{ characters.length }} rows kept.</span>
      <button type="button" class="ss-btn" @click="retry()">Retry</button>
    </div>
  </div>
</template>
