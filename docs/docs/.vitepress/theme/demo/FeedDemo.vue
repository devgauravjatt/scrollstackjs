<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * The baseline: an auto-loading feed over the Rick and Morty API, whose
 * `info.next` is a full URL — so the page param here is a string, not a number.
 * The panel on the right is the live snapshot, read straight from `state`.
 */
import { computed } from 'vue'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from './api'
import CharacterRow from './CharacterRow.vue'
import Skeleton from './Skeleton.vue'

const { state, target, retry, reset } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal),
  getNextPageParam: (last) => last.next,
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))

const flags = computed(
  () =>
    [
      ['isIdle', state.value.isIdle],
      ['isLoading', state.value.isLoading],
      ['isSuccess', state.value.isSuccess],
      ['isError', state.value.isError],
      ['isFetching', state.value.isFetching],
      ['isFetchingNextPage', state.value.isFetchingNextPage],
    ] as const,
)
</script>

<template>
  <div class="ss-demo ss-demo--split">
    <div class="ss-demo__main">
      <div class="ss-bar">
        <span class="ss-bar__title">
          <span class="ss-dot" /> rickandmortyapi.com — cursor pagination
        </span>
        <button type="button" class="ss-btn" @click="reset()">Reset</button>
      </div>

      <div class="ss-box">
        <Skeleton v-if="state.isLoading" />

        <div v-else-if="state.isError" class="ss-state" role="alert">
          <p>Couldn’t reach the API — {{ String(state.error) }}</p>
          <button type="button" class="ss-btn" @click="retry()">Try again</button>
        </div>

        <ul v-else class="ss-list">
          <CharacterRow
            v-for="character in characters"
            :key="character.id"
            :character="character"
          />
        </ul>

        <!-- Sentinel: scrolling it into view loads the next page. -->
        <div v-if="state.hasNextPage && !state.isError" :ref="target" class="ss-sentinel">
          <template v-if="state.isFetchingNextPage">
            <span class="ss-spinner" /> Loading more…
          </template>
        </div>

        <p v-else-if="characters.length > 0" class="ss-end">
          That’s all {{ characters.length }} characters.
        </p>
      </div>
    </div>

    <aside class="ss-inspect">
      <p class="ss-inspect__head">Live snapshot</p>
      <dl class="ss-inspect__grid">
        <dt>status</dt>
        <dd>
          <code>{{ state.status }}</code>
        </dd>
        <dt>fetchStatus</dt>
        <dd>
          <code>{{ state.fetchStatus }}</code>
        </dd>
        <dt>pages</dt>
        <dd>
          <code>{{ state.pages.length }}</code>
        </dd>
        <dt>rows</dt>
        <dd>
          <code>{{ characters.length }}</code>
        </dd>
        <dt>hasNextPage</dt>
        <dd>
          <code>{{ state.hasNextPage }}</code>
        </dd>
        <dt>failureCount</dt>
        <dd>
          <code>{{ state.failureCount }}</code>
        </dd>
      </dl>

      <p class="ss-inspect__head">Derived</p>
      <ul class="ss-flags">
        <li v-for="[name, on] in flags" :key="name" :class="['ss-flag', on && 'ss-flag--on']">
          {{ name }}
        </li>
      </ul>
    </aside>
  </div>
</template>
