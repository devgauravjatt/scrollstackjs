<script setup lang="ts">
/**
 * Virtualization on its own — no API, no pagination. Ten thousand rows exist in
 * an array; a dozen exist in the DOM. The counters underneath are the whole
 * point: watch `rendered` stay flat while `first`/`last` slide.
 *
 * Row heights here are decided by the stylesheet, not by `estimateSize` — the
 * `measure` ref corrects the estimate on first paint, which is why the scrollbar
 * settles instead of drifting.
 */
import { useVirtualizer } from '@scrollstackjs/vue/virtual'
import { computed } from 'vue'

const ROLES = ['engineer', 'designer', 'analyst', 'writer', 'operator'] as const

const rows = Array.from({ length: 10_000 }, (_, index) => ({
  id: index + 1,
  name: `Record ${(index + 1).toLocaleString('en-US')}`,
  role: ROLES[index % ROLES.length]!,
}))

const { state, scrollTarget, measure, scrollToIndex } = useVirtualizer({
  count: rows.length,
  estimateSize: () => 44,
  overscan: 4,
})

const inDom = computed(() => state.value.items.length)
</script>

<template>
  <div class="ss-demo">
    <div class="ss-bar">
      <span class="ss-bar__title">
        <span class="ss-dot" /> 10,000 rows — nothing fetched, nothing paginated
      </span>
      <div class="ss-bar__controls">
        <button type="button" class="ss-btn" @click="scrollToIndex(0, { align: 'start' })">
          Top
        </button>
        <button type="button" class="ss-btn" @click="scrollToIndex(5000, { align: 'center' })">
          Middle
        </button>
        <button
          type="button"
          class="ss-btn"
          @click="scrollToIndex(rows.length - 1, { align: 'end' })"
        >
          End
        </button>
      </div>
    </div>

    <div :ref="scrollTarget" class="ss-box">
      <!-- The spacer holds the scrollbar honest: it is as tall as all 10,000 rows. -->
      <div :style="{ height: `${state.totalSize}px`, position: 'relative' }">
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
          <span class="ss-row__name">{{ rows[item.index]!.name }}</span>
          <span class="ss-row__role">{{ rows[item.index]!.role }}</span>
          <!-- `.ss-row__id` carries margin-left:auto, so it belongs last. -->
          <span class="ss-row__id">#{{ rows[item.index]!.id }}</span>
        </div>
      </div>
    </div>

    <div class="ss-counters">
      <div class="ss-counter">
        <span class="ss-counter__n">{{ inDom }}</span>
        <span class="ss-counter__l">rows in the DOM</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{ rows.length.toLocaleString('en-US') }}</span>
        <span class="ss-counter__l">rows in the array</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{ state.startIndex }}–{{ state.endIndex }}</span>
        <span class="ss-counter__l">rendered window</span>
      </div>
      <div class="ss-counter">
        <span class="ss-counter__n">{{ state.totalSize.toLocaleString('en-US') }}px</span>
        <span class="ss-counter__l">total size</span>
      </div>
    </div>
  </div>
</template>
