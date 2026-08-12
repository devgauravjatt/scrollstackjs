<script setup lang="ts">
import type { Character } from './api'

defineProps<{ character: Character }>()
</script>

<template>
  <li class="ss-row">
    <img
      class="ss-avatar"
      :src="character.image"
      :alt="character.name"
      loading="lazy"
      width="30"
      height="30"
    />
    <span>
      <strong class="ss-row__name">{{ character.name }}</strong>
      <span class="ss-row__role">{{ character.species }} · {{ character.status }}</span>
    </span>
    <span class="ss-row__id">#{{ character.id }}</span>
  </li>
</template>
