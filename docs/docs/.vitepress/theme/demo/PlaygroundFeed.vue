<script setup lang="ts">
import type { ScrollStackPlugin } from '@scrollstackjs/core'
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * The engine half of the playground. It lives in its own component so the parent
 * can remount it with a `key` whenever a setting changes — which is exactly what
 * you have to do in a real app, because options are read once, at creation.
 */
import { computed, ref } from 'vue'

import { BROKEN_CHARACTERS_URL, CHARACTERS_URL, fetchCharacters, type CharacterPage } from './api'

const props = defineProps<{
  /** `null` means the viewport — exactly what the engine's default is. */
  root: Element | null
  autoLoad: boolean
  retry: number
  retryDelay: number
  rootMargin: string
  threshold: number
  delay: number
  broken: boolean
}>()

const emit = defineEmits<{ (event: 'log', line: string): void }>()

const recorder: ScrollStackPlugin<CharacterPage, string> = (engine) => {
  const offs = [
    engine.on('loadStart', () => emit('log', 'loadStart')),
    engine.on('success', ({ pages }) => emit('log', `success · ${pages.length} page(s)`)),
    engine.on('error', ({ error }) => emit('log', `error · ${String(error)}`)),
    engine.on('reset', () => emit('log', 'reset')),
  ]
  return () => offs.forEach((off) => off())
}

const { state, target, loadNextPage, retry, reset } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) =>
    fetchCharacters(props.broken ? BROKEN_CHARACTERS_URL : pageParam, signal, props.delay),
  getNextPageParam: (last) => last.next,
  autoLoad: props.autoLoad,
  retry: props.retry,
  retryDelay: (failureCount) => props.retryDelay * failureCount,
  root: props.root,
  rootMargin: props.rootMargin,
  threshold: props.threshold,
  plugins: [recorder],
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))
const retrying = computed(() => state.value.failureCount > 0 && state.value.error === null)

defineExpose({ loadNextPage, retry, reset, state })
</script>

<template>
  <ul class="ss-list">
    <li v-for="character in characters" :key="character.id" class="ss-row">
      <img class="ss-avatar" :src="character.image" :alt="character.name" loading="lazy" />
      <span class="ss-row__name">{{ character.name }}</span>
      <span class="ss-row__id">#{{ character.id }}</span>
    </li>
  </ul>

  <div v-if="state.hasNextPage" :ref="target" class="ss-sentinel ss-sentinel--marked">
    <template v-if="retrying">
      <span class="ss-spinner" /> retry {{ state.failureCount }}/{{ props.retry }}
    </template>
    <template v-else-if="state.isFetching"><span class="ss-spinner" /> fetching…</template>
    <template v-else-if="state.error !== null">fetch failed — press retry()</template>
    <template v-else>sentinel</template>
  </div>

  <p v-else-if="characters.length > 0" class="ss-end">end of list ({{ characters.length }})</p>
</template>
