<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 5 })
</script>

<template>
  <ul class="ss-list">
    <li v-for="n in rows" :key="n" class="ss-row ss-row--skeleton">
      <span class="ss-avatar" />
      <span class="ss-skel-lines">
        <span class="ss-skel" />
        <span class="ss-skel ss-skel--short" />
      </span>
    </li>
  </ul>
</template>
