# @scrollstackjs/vue

[![npm](https://img.shields.io/npm/v/@scrollstackjs/vue.svg?color=1e9e6a)](https://www.npmjs.com/package/@scrollstackjs/vue)
[![gzipped](https://img.shields.io/badge/gzipped-0.29%20kB-1e9e6a)](https://scrollstack.js.org/api/vue)
[![license](https://img.shields.io/npm/l/@scrollstackjs/vue.svg?color=1e9e6a)](https://github.com/devgauravjatt/scrollstackjs/blob/main/LICENSE)

Vue 3 adapter for [ScrollStack](https://scrollstack.js.org/) — a headless
`useInfiniteScroll` composable. You bring the markup; the engine owns the behavior.
**0.29 KB gzipped**, with teardown wired to the effect scope so it cleans up on
unmount.

📖 **[Docs](https://scrollstack.js.org/)** · [API reference](https://scrollstack.js.org/api/vue) · [Live demo](https://scrollstack.js.org/demo) · [Tutorial](https://scrollstack.js.org/tutorial)

```bash
npm i @scrollstackjs/vue
```

Requires Vue >= 3.3. Pulls in `@scrollstackjs/core` automatically.

## Quick start

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

## Handling errors

A failed _load-more_ keeps the pages you already have — `status` stays `'success'`
while `error` is set, so you can offer a retry without blanking the list:

```vue
<button v-if="state.error && state.pages.length && !state.isFetching" @click="retry">
  Retry
</button>
```

> **Why `:ref="target"` and not `ref="target"`?** Vue invokes function refs on every
> patch, so the adapter dedupes on the observed node — otherwise each re-render would
> attach a fresh observer and trigger a refetch loop. Bind it as a dynamic ref.

## Learn more

|                                                                     |                                             |
| ------------------------------------------------------------------- | ------------------------------------------- |
| [Getting started](https://scrollstack.js.org/guide/getting-started) | Install and first feed                      |
| [Core concepts](https://scrollstack.js.org/guide/concepts)          | The snapshot and the two-axis state machine |
| [Pagination](https://scrollstack.js.org/guide/pagination)           | Cursor, offset and page-number recipes      |
| [Errors & retry](https://scrollstack.js.org/guide/errors-and-retry) | Backoff, manual retry, load-more failures   |
| [Server rendering](https://scrollstack.js.org/guide/ssr)            | What runs where                             |
| [Devtools](https://scrollstack.js.org/api/devtools)                 | Inspect the engine while you build          |

## Contributing

Issues and pull requests are welcome — see
[CONTRIBUTING.md](https://github.com/devgauravjatt/scrollstackjs/blob/main/CONTRIBUTING.md).

MIT © [devgauravjatt](https://github.com/devgauravjatt)
