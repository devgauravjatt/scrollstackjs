<script setup lang="ts">
/**
 * The parent half: it renders the scroll container and only mounts the track once
 * the element exists, because options — `root` included — are read once, when the
 * composable runs.
 */
import { ref, useTemplateRef } from 'vue'

import * as ui from '../ui'
import RailTrack from './RailTrack.vue'

const track = useTemplateRef<HTMLElement>('track')
const generation = ref(0)

function reset(): void {
  track.value?.scrollTo({ left: 0 })
  generation.value += 1
}
</script>

<template>
  <div :class="ui.card">
    <div :class="ui.bar">
      <span :class="ui.barTitle">
        <span :class="ui.dot" /> Horizontal — <code :class="ui.code">root</code> is the rail
      </span>
      <button type="button" :class="ui.btn" @click="reset()">Reset</button>
    </div>

    <div
      ref="track"
      class="flex [scroll-snap-type:x_proximity] [scrollbar-width:thin] [scrollbar-color:#334155_transparent] gap-3 overflow-x-auto overflow-y-hidden p-4"
    >
      <RailTrack v-if="track" :key="generation" :root="track" />
    </div>
  </div>
</template>
