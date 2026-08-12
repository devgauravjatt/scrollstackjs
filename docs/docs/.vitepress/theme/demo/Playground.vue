<script setup lang="ts">
/**
 * Every engine option as a live control. Changing any of them remounts the child
 * — options are read once at creation, so this is the honest way to model it.
 */
import { computed, ref, useTemplateRef } from 'vue'

import PlaygroundFeed from './PlaygroundFeed.vue'

const viewport = useTemplateRef<HTMLElement>('viewport')
const feed = useTemplateRef<InstanceType<typeof PlaygroundFeed>>('feed')

const autoLoad = ref(true)
const retry = ref(2)
const retryDelay = ref(400)
const rootMargin = ref('0px')
const threshold = ref(0)
const delay = ref(700)
const scoped = ref(true)
const broken = ref(false)

const log = ref<{ id: number; text: string }[]>([])
let nextId = 0

function append(text: string): void {
  log.value = [{ id: nextId++, text }, ...log.value].slice(0, 6)
}

// Every setting is part of the key: touch one, and a fresh engine is created.
const engineKey = computed(() =>
  [
    autoLoad.value,
    retry.value,
    retryDelay.value,
    rootMargin.value,
    threshold.value,
    delay.value,
    scoped.value,
  ].join('|'),
)

const code = computed(() =>
  [
    'useInfiniteScroll({',
    "  initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',",
    '  fetchPage: ({ pageParam, signal }) => fetch(pageParam, { signal }).then((r) => r.json()),',
    '  getNextPageParam: (last) => last.info.next,',
    '',
    `  autoLoad: ${autoLoad.value},`,
    `  retry: ${retry.value},`,
    `  retryDelay: (failureCount) => ${retryDelay.value} * failureCount,`,
    scoped.value ? '  root: scrollBoxElement,' : '  root: null, // the viewport',
    `  rootMargin: '${rootMargin.value}',`,
    `  threshold: ${threshold.value},`,
    '})',
  ].join('\n'),
)
</script>

<template>
  <div class="ss-play">
    <div class="ss-play__controls">
      <p class="ss-inspect__head">Observer</p>

      <label class="ss-field">
        <span>
          <code>autoLoad</code>
          <em>intersection triggers a fetch at all</em>
        </span>
        <input v-model="autoLoad" type="checkbox" />
      </label>

      <label class="ss-field">
        <span>
          <code>root</code>
          <em>{{ scoped ? 'the scroll box below' : 'null — the viewport' }}</em>
        </span>
        <input v-model="scoped" type="checkbox" />
      </label>

      <label class="ss-field ss-field--col">
        <span>
          <code>rootMargin</code>
          <em>grows the root box, so loading starts earlier</em>
        </span>
        <select v-model="rootMargin">
          <option value="0px">0px — at the edge</option>
          <option value="0px 0px 120px 0px">0px 0px 120px 0px — 120px early</option>
          <option value="0px 0px 400px 0px">0px 0px 400px 0px — 400px early</option>
        </select>
      </label>

      <label class="ss-field ss-field--col">
        <span>
          <code>threshold</code>
          <em>fraction of the sentinel that must be visible — {{ threshold }}</em>
        </span>
        <input v-model.number="threshold" type="range" min="0" max="1" step="0.25" />
      </label>

      <p class="ss-inspect__head">Retry</p>

      <label class="ss-field ss-field--col">
        <span>
          <code>retry</code>
          <em>attempts after a failure before `error` is set — {{ retry }}</em>
        </span>
        <input v-model.number="retry" type="range" min="0" max="4" step="1" />
      </label>

      <label class="ss-field ss-field--col">
        <span>
          <code>retryDelay</code>
          <em>{{ retryDelay }}ms × failureCount (real default: exponential to 30s)</em>
        </span>
        <input v-model.number="retryDelay" type="range" min="100" max="2000" step="100" />
      </label>

      <p class="ss-inspect__head">This demo’s fake API</p>

      <label class="ss-field ss-field--col">
        <span>
          <code>delay</code>
          <em>artificial latency — {{ delay }}ms</em>
        </span>
        <input v-model.number="delay" type="range" min="0" max="3000" step="100" />
      </label>

      <label class="ss-field">
        <span>
          <code>broken</code>
          <em>point the next fetch at a URL that 404s</em>
        </span>
        <input v-model="broken" type="checkbox" />
      </label>
    </div>

    <div class="ss-play__stage">
      <div class="ss-bar">
        <span class="ss-bar__title"><span class="ss-dot" /> live engine</span>
        <div class="ss-bar__controls">
          <button type="button" class="ss-btn" @click="feed?.loadNextPage()">loadNextPage()</button>
          <button type="button" class="ss-btn" @click="feed?.retry()">retry()</button>
          <button type="button" class="ss-btn" @click="feed?.reset()">reset()</button>
        </div>
      </div>

      <div ref="viewport" class="ss-box ss-box--short">
        <PlaygroundFeed
          v-if="viewport"
          :key="engineKey"
          ref="feed"
          :root="scoped ? viewport : null"
          :auto-load="autoLoad"
          :retry="retry"
          :retry-delay="retryDelay"
          :root-margin="rootMargin"
          :threshold="threshold"
          :delay="delay"
          :broken="broken"
          @log="append"
        />
      </div>

      <ol class="ss-log ss-log--compact">
        <li v-if="log.length === 0" class="ss-log__empty">events appear here</li>
        <li v-for="line in log" :key="line.id" class="ss-log__line">{{ line.text }}</li>
      </ol>

      <pre class="ss-play__code"><code>{{ code }}</code></pre>
    </div>
  </div>
</template>
