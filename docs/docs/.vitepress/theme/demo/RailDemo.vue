<script setup lang="ts">
/**
 * The parent half: it renders the scroll container and only mounts the track once
 * the element exists, because options — `root` included — are read once, when the
 * composable runs.
 */
import { ref, useTemplateRef } from 'vue'

import RailTrack from './RailTrack.vue'

const track = useTemplateRef<HTMLElement>('track')
const mounted = ref(0) // bumping this remounts the track with a fresh engine

function reset(): void {
  track.value?.scrollTo({ left: 0 })
  mounted.value += 1
}
</script>

<template>
  <div class="ss-demo">
    <div class="ss-bar">
      <span class="ss-bar__title">
        <span class="ss-dot" /> Horizontal — <code>root</code> is the rail
      </span>
      <button type="button" class="ss-btn" @click="reset()">Reset</button>
    </div>

    <div ref="track" class="ss-rail">
      <RailTrack v-if="track" :key="mounted" :root="track" />
    </div>
  </div>
</template>
