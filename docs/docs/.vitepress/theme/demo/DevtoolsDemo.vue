<script setup lang="ts">
import { createDevtools, type Devtools } from '@scrollstackjs/devtools'
import { useInfiniteScroll } from '@scrollstackjs/vue'
/**
 * The real `@scrollstackjs/devtools` panel attached to a real engine — not a
 * screenshot and not a reimplementation.
 *
 * The panel is `position: fixed`, exactly as it is in an app, so it floats over
 * the page rather than sitting inside this box. That means it outlives this
 * component's DOM, and leaving the page has to tear it down explicitly.
 */
import { computed, onScopeDispose, ref } from 'vue'

import { BROKEN_CHARACTERS_URL, CHARACTERS_URL, fetchCharacters, type CharacterPage } from './api'
import CharacterRow from './CharacterRow.vue'

const broken = ref(false)
const isMounted = ref(false)

// Deliberately not a ref: the panel owns raw DOM nodes and must not be proxied.
let devtools: Devtools<CharacterPage, string> | null = null

const { state, loadNextPage, retry, reset, engine } = useInfiniteScroll<CharacterPage, string>({
  initialPageParam: CHARACTERS_URL,
  fetchPage: ({ pageParam, signal }) =>
    // Shorter than the other demos: the point here is to fill the timeline.
    fetchCharacters(broken.value ? BROKEN_CHARACTERS_URL : pageParam, signal, 900),
  getNextPageParam: (last) => last.next,
  autoLoad: false,
  retry: 1,
  retryDelay: () => 400,
})

const characters = computed(() => state.value.pages.flatMap((page) => page.results))

function togglePanel(): void {
  if (devtools) {
    devtools.destroy()
    devtools = null
    isMounted.value = false
    return
  }

  // A docs-only storage key, so the remembered layout can't collide with a panel
  // the reader has open from their own app.
  devtools = createDevtools(engine, {
    storageKey: 'scrollstack-docs-demo',
    open: true,
    theme: 'dark',
  })
  devtools.mount()
  isMounted.value = true
}

onScopeDispose(() => {
  devtools?.destroy()
  devtools = null
})
</script>

<template>
  <div class="ss-demo">
    <div class="ss-bar">
      <span class="ss-bar__title"> <span class="ss-dot" /> rickandmortyapi — inspected live </span>
      <div class="ss-bar__controls">
        <button type="button" class="ss-btn ss-btn--primary" @click="togglePanel()">
          {{ isMounted ? 'Close devtools' : 'Open devtools' }}
        </button>
        <label class="ss-toggle">
          <input v-model="broken" type="checkbox" />
          Break the next fetch (404)
        </label>
        <button type="button" class="ss-btn" @click="reset()">Reset</button>
      </div>
    </div>

    <div class="ss-box ss-box--short">
      <ul class="ss-list">
        <CharacterRow v-for="character in characters" :key="character.id" :character="character" />
      </ul>

      <p v-if="characters.length === 0" class="ss-end">
        Open the panel, then load a page — the timeline records every step.
      </p>
      <p v-else-if="!state.hasNextPage" class="ss-end">That’s all {{ characters.length }}.</p>
    </div>

    <div class="ss-footer">
      <div class="ss-bar__controls">
        <button
          type="button"
          class="ss-btn"
          :disabled="!state.hasNextPage || state.isFetching"
          @click="loadNextPage()"
        >
          {{ state.isFetching ? 'Loading…' : 'Load a page' }}
        </button>
        <button type="button" class="ss-btn" :disabled="state.error === null" @click="retry()">
          Retry
        </button>
      </div>
      <span class="ss-footer__note">
        {{ isMounted ? 'Panel is live — drag its header to move it.' : 'Panel is closed.' }}
      </span>
    </div>
  </div>
</template>
