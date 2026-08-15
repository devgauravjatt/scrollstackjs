<script setup lang="ts">
import { connectInfiniteScroll } from '@scrollstackjs/virtual'
/**
 * Both stores at once: the engine loads pages, the virtualizer renders a window
 * of them. `connectInfiniteScroll` is what replaces the sentinel — a virtual list
 * cannot render the element after the last row, so loading triggers on the
 * *index* the window has reached instead of on geometry.
 *
 * The only thing tying the two together is `count`. The engine never hears about
 * pixels; the virtualizer never hears about pages.
 */
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { useVirtualizer } from '@scrollstackjs/vue/virtual'
import { computed, onScopeDispose } from 'vue'

import { fetchPokemon, POKEMON_LIMIT, pokemonSprite, type Pokemon } from './api'

const {
  state: feed,
  engine,
  reset,
} = useInfiniteScroll<readonly Pokemon[], number>({
  initialPageParam: 0,
  fetchPage: ({ pageParam, signal }) => fetchPokemon(pageParam, signal),
  getNextPageParam: (last, all) =>
    last.length < POKEMON_LIMIT ? null : all.length * POKEMON_LIMIT,
})

const rows = computed(() => feed.value.pages.flat())

const { state, scrollTarget, measure, virtualizer } = useVirtualizer({
  count: () => rows.value.length,
  estimateSize: () => 56,
  overscan: 5,
})

// Loads the first page too — with no sentinel, nothing else would start it.
onScopeDispose(connectInfiniteScroll(virtualizer, engine, { threshold: 4 }))
</script>

<template>
  <div class="ss-demo">
    <div class="ss-bar">
      <span class="ss-bar__title">
        <span class="ss-dot" :class="{ 'ss-dot--warn': feed.isFetching }" />
        pokeapi.co — offset pagination, virtualized
      </span>
      <div class="ss-bar__controls">
        <button type="button" class="ss-btn" @click="reset()">Reset</button>
      </div>
    </div>

    <div :ref="scrollTarget" class="ss-box">
      <div v-if="feed.isError" class="ss-state" role="alert">
        <p>Couldn’t reach the API — {{ String(feed.error) }}</p>
        <button type="button" class="ss-btn" @click="engine.retry()">Try again</button>
      </div>

      <div v-else :style="{ height: `${state.totalSize}px`, position: 'relative' }">
        <div
          v-for="item in state.items"
          :key="item.key"
          :ref="measure"
          :data-index="item.index"
          class="ss-row"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${item.start}px)`,
          }"
        >
          <img
            class="ss-avatar ss-avatar--sprite"
            :src="pokemonSprite(rows[item.index]!.url)"
            :alt="rows[item.index]!.name"
            loading="lazy"
          />
          <span class="ss-row__name ss-row__name--caps">{{ rows[item.index]!.name }}</span>
          <!-- `.ss-row__id` carries margin-left:auto, so it belongs last. -->
          <span class="ss-row__id">#{{ item.index + 1 }}</span>
        </div>
      </div>

      <p v-if="feed.isLoading" class="ss-sentinel">Loading the first page…</p>
    </div>

    <div class="ss-counters">
      <div class="ss-counter">
        <span class="ss-counter__n">{{ state.items.length }}</span>
        <span class="ss-counter__l">rows in the DOM</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{ rows.length }}</span>
        <span class="ss-counter__l">rows loaded</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{ feed.pages.length }}</span>
        <span class="ss-counter__l">pages fetched</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{
          feed.isFetchingNextPage ? 'fetching' : feed.fetchStatus
        }}</span>
        <span class="ss-counter__l">engine</span>
      </div>
    </div>

    <p class="ss-footer__note">
      Scroll to within four rows of the end and the next page is requested — the virtualizer reports
      where the window is, the engine does the fetching.
    </p>
  </div>
</template>
