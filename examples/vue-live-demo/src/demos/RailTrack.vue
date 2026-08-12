<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * The child half of the horizontal pattern: it mounts *inside* the scroll
 * container and receives it as `root`, which is what makes a right-hand
 * `rootMargin` mean "before the end of the rail".
 */
import { computed } from 'vue'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
import * as ui from '../ui'

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
    <div
      v-for="n in 6"
      :key="n"
      class="h-[104px] w-[148px] shrink-0 animate-pulse rounded-lg bg-slate-800"
    />
  </template>

  <figure
    v-for="character in characters"
    :key="character.id"
    class="w-[148px] shrink-0 [scroll-snap-align:start]"
  >
    <img
      :src="character.image"
      :alt="character.name"
      loading="lazy"
      class="h-[104px] w-full rounded-lg bg-slate-800 object-cover"
    />
    <figcaption class="pt-2">
      <strong class="block truncate text-[13px] font-medium">{{ character.name }}</strong>
      <span class="block text-[11.5px] text-slate-500">{{ character.species }}</span>
    </figcaption>
  </figure>

  <!-- A sentinel in a rail needs real width — a zero-width flex item never intersects. -->
  <div
    v-if="state.hasNextPage"
    :ref="target"
    class="grid h-[104px] w-[148px] shrink-0 place-items-center rounded-lg border border-dashed border-slate-700"
  >
    <span v-if="state.isFetchingNextPage" :class="ui.spinner" />
  </div>

  <div
    v-else-if="characters.length > 0"
    class="grid h-[104px] w-[148px] shrink-0 place-items-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500"
  >
    All {{ characters.length }}
  </div>
</template>
