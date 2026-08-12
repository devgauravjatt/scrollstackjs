<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * `autoLoad: false` keeps the observer out of it entirely — the PokéAPI paginates
 * by offset and a button drives it. `loadNextPage()` no-ops while a fetch is in
 * flight or once `hasNextPage` is false, so `disabled` below is only cosmetic.
 */
import { computed } from 'vue'

import { POKEMON_LIMIT, fetchPokemon, pokemonSprite, type Pokemon } from '../api'
import * as ui from '../ui'

const { state, loadNextPage, reset } = useInfiniteScroll<readonly Pokemon[], number>({
  initialPageParam: 0,
  fetchPage: ({ pageParam, signal }) => fetchPokemon(pageParam, signal),
  // A short page means the end — otherwise advance by the limit.
  getNextPageParam: (lastPage, _all, lastParam) =>
    lastPage.length === POKEMON_LIMIT ? lastParam + POKEMON_LIMIT : null,
  autoLoad: false,
})

const pokemon = computed(() => state.value.pages.flat())
</script>

<template>
  <div :class="ui.card">
    <div :class="ui.bar">
      <span :class="ui.barTitle">
        <span :class="ui.dot" /> pokeapi.co — offset,
        <code :class="ui.code">autoLoad: false</code>
      </span>
      <button type="button" :class="ui.btn" @click="reset()">Reset</button>
    </div>

    <div :class="`${ui.scrollBox} h-60`">
      <p v-if="state.isIdle" class="p-5 text-center text-[13px] text-slate-500">
        Nothing fetched yet — press the button.
      </p>

      <p v-if="state.isError" class="p-5 text-center text-[13px] text-red-300" role="alert">
        {{ String(state.error) }}
      </p>

      <ul>
        <li v-for="(item, index) in pokemon" :key="item.name" :class="ui.row">
          <img
            :src="pokemonSprite(item.url)"
            :alt="item.name"
            loading="lazy"
            class="size-8 shrink-0 rounded-full bg-slate-800 object-contain [image-rendering:pixelated]"
          />
          <span>
            <strong class="block text-[13.5px] font-medium capitalize">{{ item.name }}</strong>
            <span class="block text-xs text-slate-500">offset {{ index }}</span>
          </span>
        </li>
      </ul>
    </div>

    <div :class="ui.footer">
      <button
        type="button"
        :class="ui.btnPrimary"
        :disabled="!state.hasNextPage || state.isFetching"
        @click="loadNextPage()"
      >
        <span v-if="state.isFetching" :class="ui.spinner" />
        {{ state.hasNextPage ? 'Load next page' : 'No more pages' }}
      </button>
      <span>{{ state.pages.length }} page(s) · params [{{ state.pageParams.join(', ') }}]</span>
    </div>
  </div>
</template>
