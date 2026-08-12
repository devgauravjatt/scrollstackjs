<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * The child half of the horizontal pattern: it mounts *inside* the scroll
 * container and receives it as `root`, which is what makes a right-hand
 * `rootMargin` mean "before the end of the rail" instead of "before the edge of
 * the window".
 */
import { computed } from 'vue'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from './api'

const props = defineProps<{ root: Element }>()

const { state, target } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal),
  getNextPageParam: (last) => last.next,
  root: props.root,
  rootMargin: '0px 240px 0px 0px',
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))
</script>

<template>
  <template v-if="state.isLoading">
    <div v-for="n in 5" :key="n" class="ss-card ss-card--skeleton" />
  </template>

  <figure v-for="character in characters" :key="character.id" class="ss-card">
    <img class="ss-card__art" :src="character.image" :alt="character.name" loading="lazy" />
    <figcaption>
      <strong>{{ character.name }}</strong>
      <span>{{ character.species }}</span>
    </figcaption>
  </figure>

  <!-- A sentinel in a rail needs real width — a zero-width flex item never intersects. -->
  <div v-if="state.hasNextPage" :ref="target" class="ss-card ss-card--sentinel">
    <template v-if="state.isFetchingNextPage"><span class="ss-spinner" /></template>
  </div>

  <div v-else-if="characters.length > 0" class="ss-card ss-card--sentinel">
    All {{ characters.length }}
  </div>
</template>
