<script setup lang="ts">
import type { InfiniteScrollOptions } from '@scrollstackjs/core'
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    source: string
    code: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: InfiniteScrollOptions<any, any>
    /** Cursor params are URLs — show only their tail. */
    truncate?: number
  }>(),
  { truncate: 0 },
)

const { state, loadNextPage, reset } = useInfiniteScroll(props.options)

// Key on the *untruncated* param: page params are unique per page, whereas two
// long cursor URLs can share a tail once truncated for display.
const params = computed(() =>
  state.value.pageParams.map((param) => {
    const key = String(param)
    const text =
      props.truncate > 0 && key.length > props.truncate ? `…${key.slice(-props.truncate)}` : key
    return { key, text }
  }),
)
</script>

<template>
  <div class="ss-strategy">
    <p class="ss-strategy__label">
      {{ label }}
      <span class="ss-strategy__source">{{ source }}</span>
    </p>
    <pre class="ss-strategy__code"><code>{{ code }}</code></pre>

    <dl class="ss-strategy__out">
      <dt>pages</dt>
      <dd>
        <code>{{ state.pages.length }}</code>
      </dd>
      <dt>hasNextPage</dt>
      <dd>
        <code>{{ state.hasNextPage }}</code>
      </dd>
    </dl>

    <ol class="ss-params">
      <li v-if="params.length === 0" class="ss-params__empty">no pages fetched yet</li>
      <li v-for="item in params" :key="item.key">
        <code>{{ item.text }}</code>
      </li>
    </ol>

    <p v-if="state.error !== null" class="ss-strategy__error">{{ String(state.error) }}</p>

    <div class="ss-strategy__actions">
      <button
        type="button"
        class="ss-btn"
        :disabled="!state.hasNextPage || state.isFetching"
        @click="loadNextPage()"
      >
        <span v-if="state.isFetching" class="ss-spinner" />
        Next page
      </button>
      <button type="button" class="ss-btn" @click="reset()">Reset</button>
    </div>
  </div>
</template>
