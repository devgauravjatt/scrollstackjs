<script setup lang="ts">
import type { InfiniteScrollOptions } from '@scrollstackjs/core'
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

import * as ui from '../ui'

const props = withDefaults(
  defineProps<{
    label: string
    source: string
    code: string
    // The card is deliberately shape-agnostic — each instance is handed a
    // differently-typed engine (cursor, offset, page number).
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
const shown = computed(() =>
  state.value.pageParams.map((param) => {
    const key = String(param)
    const text =
      props.truncate > 0 && key.length > props.truncate ? `…${key.slice(-props.truncate)}` : key
    return { key, text }
  }),
)
</script>

<template>
  <div class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
    <p class="text-xs font-semibold tracking-wider text-teal-300 uppercase">
      {{ label }}
      <span
        class="mt-0.5 block text-[10.5px] font-normal tracking-normal text-slate-500 normal-case"
      >
        {{ source }}
      </span>
    </p>

    <pre
      class="overflow-x-auto rounded-lg bg-slate-950 p-2.5 text-[11px] leading-relaxed text-slate-400"
    ><code>{{ code }}</code></pre>

    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      <dt class="text-slate-500">pages</dt>
      <dd class="text-right font-mono text-[11.5px]">{{ state.pages.length }}</dd>
      <dt class="text-slate-500">hasNextPage</dt>
      <dd class="text-right font-mono text-[11.5px]">{{ state.hasNextPage }}</dd>
    </dl>

    <ol class="min-h-18 rounded-lg bg-slate-950 p-2.5 text-[11px]">
      <li v-if="shown.length === 0" class="text-slate-600">no pages fetched yet</li>
      <li v-for="item in shown" :key="item.key" class="font-mono break-all text-slate-400">
        {{ item.text }}
      </li>
    </ol>

    <p v-if="state.error !== null" class="text-[11.5px] text-red-300">
      {{ String(state.error) }}
    </p>

    <div class="mt-auto flex gap-2">
      <button
        type="button"
        :class="ui.btn"
        :disabled="!state.hasNextPage || state.isFetching"
        @click="loadNextPage()"
      >
        <span v-if="state.isFetching" :class="ui.spinner" />
        Next page
      </button>
      <button type="button" :class="ui.btn" @click="reset()">Reset</button>
    </div>
  </div>
</template>
