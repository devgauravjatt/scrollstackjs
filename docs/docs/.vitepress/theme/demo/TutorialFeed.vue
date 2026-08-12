<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Step 2 of the tutorial: the smallest thing that works. Three options in, a
 * snapshot and a sentinel ref out — no error handling, no states, nothing else.
 */
import { computed } from 'vue'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from './api'

const { state, target } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal, 700),
  getNextPageParam: (last) => last.next,
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))
</script>

<template>
  <div class="ss-demo">
    <div class="ss-box ss-box--short">
      <ul class="ss-list">
        <li v-for="character in characters" :key="character.id" class="ss-row">
          <img class="ss-avatar" :src="character.image" :alt="character.name" loading="lazy" />
          <span class="ss-row__name">{{ character.name }}</span>
        </li>
      </ul>

      <div v-if="state.hasNextPage" :ref="target" class="ss-sentinel">
        <template v-if="state.isFetching"><span class="ss-spinner" /> Loading…</template>
      </div>
    </div>
  </div>
</template>
