<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * The baseline: a sentinel rendered while `hasNextPage` is true, plus a live view
 * of the snapshot. The page param is a *URL string* here — the API's cursor is a
 * whole link, and `getNextPageParam` just returns whatever it hands back.
 */
import { computed } from 'vue'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
import * as ui from '../ui'

const { state, target, retry, reset } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal),
  getNextPageParam: (last) => last.next,
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))

const fields = computed(() => [
  ['status', state.value.status],
  ['fetchStatus', state.value.fetchStatus],
  ['pages', state.value.pages.length],
  ['rows', characters.value.length],
  ['hasNextPage', String(state.value.hasNextPage)],
  ['failureCount', state.value.failureCount],
])

const flags = computed(() => [
  ['isIdle', state.value.isIdle],
  ['isLoading', state.value.isLoading],
  ['isSuccess', state.value.isSuccess],
  ['isError', state.value.isError],
  ['isFetching', state.value.isFetching],
  ['isFetchingNextPage', state.value.isFetchingNextPage],
])
</script>

<template>
  <div :class="`${ui.card} grid lg:grid-cols-[minmax(0,1fr)_232px]`">
    <div>
      <div :class="ui.bar">
        <span :class="ui.barTitle">
          <span :class="ui.dot" /> rickandmortyapi.com — cursor pagination
        </span>
        <button type="button" :class="ui.btn" @click="reset()">Reset</button>
      </div>

      <div :class="ui.scrollBox">
        <ul v-if="state.isLoading">
          <li v-for="n in 6" :key="n" :class="ui.row">
            <span class="size-8 shrink-0 animate-pulse rounded-full bg-slate-800" />
            <span class="flex flex-1 flex-col gap-2">
              <span class="h-2.5 w-2/5 animate-pulse rounded bg-slate-800" />
              <span class="h-2.5 w-1/4 animate-pulse rounded bg-slate-800" />
            </span>
          </li>
        </ul>

        <div
          v-else-if="state.isError"
          class="flex flex-col items-center gap-3 p-6 text-center text-[13px] text-slate-400"
          role="alert"
        >
          <p>Couldn’t reach the API — {{ String(state.error) }}</p>
          <button type="button" :class="ui.btn" @click="retry()">Try again</button>
        </div>

        <ul v-else>
          <li v-for="character in characters" :key="character.id" :class="ui.row">
            <img
              :src="character.image"
              :alt="character.name"
              loading="lazy"
              class="size-8 shrink-0 rounded-full bg-slate-800 object-cover"
            />
            <span>
              <strong class="block text-[13.5px] font-medium">{{ character.name }}</strong>
              <span class="block text-xs text-slate-500">
                {{ character.species }} · {{ character.status }}
              </span>
            </span>
            <span class="ml-auto font-mono text-[11px] text-slate-600">#{{ character.id }}</span>
          </li>
        </ul>

        <!-- Sentinel: scrolling it into view loads the next page. -->
        <div v-if="state.hasNextPage && !state.isError" :ref="target" :class="ui.sentinel">
          <template v-if="state.isFetchingNextPage">
            <span :class="ui.spinner" /> Loading more…
          </template>
        </div>

        <p v-else-if="characters.length > 0" class="p-5 text-center text-[13px] text-slate-500">
          That’s all {{ characters.length }} characters.
        </p>
      </div>
    </div>

    <aside class="border-t border-slate-800 bg-slate-900 p-4 lg:border-t-0 lg:border-l">
      <p class="mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
        Live snapshot
      </p>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <template v-for="[label, value] in fields" :key="label">
          <dt class="text-slate-500">{{ label }}</dt>
          <dd class="text-right font-mono text-[11.5px] text-slate-300">{{ value }}</dd>
        </template>
      </dl>

      <p class="mt-4 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
        Derived
      </p>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="[name, on] in flags"
          :key="name as string"
          class="rounded-full border px-2 py-0.5 font-mono text-[10.5px]"
          :class="
            on ? 'border-teal-400 bg-teal-400 text-teal-950' : 'border-slate-800 text-slate-600'
          "
        >
          {{ name }}
        </li>
      </ul>
    </aside>
  </div>
</template>
