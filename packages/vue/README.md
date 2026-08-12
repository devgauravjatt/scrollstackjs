# @scrollstackjs/vue

Vue 3 adapter for [ScrollStack](https://www.npmjs.com/package/@scrollstackjs/core) —
a headless `useInfiniteScroll` composable. You bring the markup; the engine owns
the behavior. Teardown is wired to the effect scope, so it cleans up on unmount.

```bash
npm i @scrollstackjs/vue
```

Requires Vue >= 3.3. Pulls in `@scrollstackjs/core` automatically.

```vue
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue';

const { state, target } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
  getNextPageParam: (last) => last.nextCursor, // null = no more pages
});
</script>

<template>
  <ul>
    <li v-for="item in state.pages.flatMap((p) => p.items)" :key="item.id">{{ item.name }}</li>
    <li v-if="state.hasNextPage" :ref="target">{{ state.isFetchingNextPage ? 'Loading…' : '' }}</li>
  </ul>
</template>
```

The `target` sentinel loads the next page when it scrolls into view. `state` is a
`shallowRef` of the core snapshot — auto-unwrapped in templates, `state.value` in
`<script setup>`. Also returned: `loadNextPage`, `retry`, `reset`, `engine`.

MIT
