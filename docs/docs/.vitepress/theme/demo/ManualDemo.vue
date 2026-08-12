<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * Both paths into the same engine, over the PokéAPI's offset pagination:
 * `autoLoad` is on, so the sentinel loads pages as you scroll, *and* the button
 * calls `loadNextPage()` directly. Neither needs a guard — `loadNextPage()`
 * no-ops while a fetch is in flight or once `hasNextPage` is false, which is
 * also what stops the two from racing each other.
 */
import { computed } from 'vue'

import { POKEMON_LIMIT, fetchPokemon, pokemonSprite, type Pokemon } from './api'

const { state, target, loadNextPage, reset } = useInfiniteScroll<readonly Pokemon[], number>({
  initialPageParam: 0,
  fetchPage: ({ pageParam, signal }) => fetchPokemon(pageParam, signal),
  // A short page means the end — otherwise advance by the limit.
  getNextPageParam: (lastPage, _all, lastParam) =>
    lastPage.length === POKEMON_LIMIT ? lastParam + POKEMON_LIMIT : null,
  autoLoad: true, // the default — set it to false to make the button the only way
})

const pokemon = computed(() => state.value.pages.flat())
</script>

<template>
  <div class="ss-demo">
    <div class="ss-bar">
      <span class="ss-bar__title">
        <span class="ss-dot" /> pokeapi.co — offset, <code>autoLoad: true</code> + a button
      </span>
      <button type="button" class="ss-btn" @click="reset()">Reset</button>
    </div>

    <div class="ss-box ss-box--short">
      <div v-if="state.isError" class="ss-state" role="alert">
        <p>{{ String(state.error) }}</p>
      </div>

      <ul class="ss-list">
        <li v-for="(item, i) in pokemon" :key="item.name" class="ss-row">
          <img
            class="ss-avatar ss-avatar--sprite"
            :src="pokemonSprite(item.url)"
            :alt="item.name"
            loading="lazy"
            width="30"
            height="30"
          />
          <span>
            <strong class="ss-row__name ss-row__name--caps">{{ item.name }}</strong>
            <span class="ss-row__role">offset {{ i }}</span>
          </span>
        </li>
      </ul>

      <!-- With autoLoad on, this sentinel is the second way in. Scroll to it. -->
      <div v-if="state.hasNextPage && !state.isError" :ref="target" class="ss-sentinel">
        <template v-if="state.isFetching"><span class="ss-spinner" /> Loading…</template>
        <template v-else>scroll here, or use the button below</template>
      </div>

      <p v-else-if="pokemon.length > 0" class="ss-end">That’s all {{ pokemon.length }}.</p>
    </div>

    <div class="ss-footer">
      <button
        type="button"
        class="ss-btn ss-btn--primary"
        :disabled="!state.hasNextPage || state.isFetching"
        @click="loadNextPage()"
      >
        <span v-if="state.isFetching" class="ss-spinner" />
        {{ state.hasNextPage ? 'Load next page' : 'No more pages' }}
      </button>
      <span class="ss-footer__note">
        {{ state.pages.length }} page(s) · params [{{ state.pageParams.join(', ') }}]
      </span>
    </div>
  </div>
</template>
