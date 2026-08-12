<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Failure handling against the real API. The toggle points the next fetch at a
 * URL that 404s, so the failure is a genuine HTTP error — the engine retries
 * twice on a short backoff (`failureCount` climbs), then surfaces `error` with
 * every already-loaded row still on screen.
 */
import { computed, ref } from 'vue'

import { BROKEN_CHARACTERS_URL, CHARACTERS_URL, fetchCharacters, type CharacterPage } from './api'
import CharacterRow from './CharacterRow.vue'

const broken = ref(false)

const { state, target, retry, reset } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) =>
    fetchCharacters(broken.value ? BROKEN_CHARACTERS_URL : pageParam, signal),
  getNextPageParam: (last) => last.next,
  retry: 2,
  retryDelay: (failureCount) => 400 * failureCount,
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))

// The load-more failure test: an error, data already on screen, nothing in flight.
const loadMoreFailed = computed(
  () => state.value.error !== null && characters.value.length > 0 && !state.value.isFetching,
)
const retrying = computed(() => state.value.failureCount > 0 && state.value.error === null)
</script>

<template>
  <div class="ss-demo">
    <div class="ss-bar">
      <span class="ss-bar__title"><span class="ss-dot ss-dot--warn" /> Errors &amp; retry</span>
      <div class="ss-bar__controls">
        <label class="ss-toggle">
          <input v-model="broken" type="checkbox" />
          Break the next fetch (404)
        </label>
        <button type="button" class="ss-btn" @click="reset()">Reset</button>
      </div>
    </div>

    <div class="ss-box ss-box--short">
      <div v-if="state.error !== null && characters.length === 0" class="ss-state" role="alert">
        <p>
          <code>{{ String(state.error) }}</code> — nothing to show, so <code>isError</code> is true.
        </p>
        <button type="button" class="ss-btn" @click="retry()">Try again</button>
      </div>

      <ul class="ss-list">
        <CharacterRow v-for="character in characters" :key="character.id" :character="character" />
      </ul>

      <div v-if="state.hasNextPage" :ref="target" class="ss-sentinel">
        <template v-if="retrying">
          <span class="ss-spinner" /> Retry {{ state.failureCount }} of 2…
        </template>
        <template v-else-if="state.isFetchingNextPage">
          <span class="ss-spinner" /> Loading more…
        </template>
      </div>

      <p v-else-if="characters.length > 0" class="ss-end">That’s all {{ characters.length }}.</p>
    </div>

    <div v-if="loadMoreFailed" class="ss-alert" role="alert">
      <span>
        Load-more failed — <code>status</code> is still <code>{{ state.status }}</code> and your
        {{ characters.length }} rows are untouched.
      </span>
      <button type="button" class="ss-btn" @click="retry()">Retry</button>
    </div>
  </div>
</template>
