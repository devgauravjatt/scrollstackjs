# Devtools

A dev-only panel that shows what the engine is actually doing: live state, an
event timeline with per-request durations, a page explorer, and manual controls.
It renders inside a shadow root, so it cannot collide with your app's styles, and
it holds no engine logic — it reads `subscribe` / `getSnapshot` / `on` and
forwards the commands the engine already exposes.

```bash
npm i -D @scrollstackjs/devtools
```

Mount the real panel below and break a fetch to watch the timeline fill up.

<DevtoolsDemo />

## The one-liner

Register it as a plugin and forget about it. The engine's `destroy()` tears the
panel down with it.

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'
import { devtoolsPlugin } from '@scrollstackjs/devtools'

export function Feed() {
  const { pages, ref } = useInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
    // An empty array in production, so the import tree-shakes away.
    plugins: import.meta.env.DEV ? [devtoolsPlugin()] : [],
  })

  return <List pages={pages} sentinelRef={ref} />
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { devtoolsPlugin } from '@scrollstackjs/devtools'

const { state, target } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  plugins: import.meta.env.DEV ? [devtoolsPlugin()] : [],
})
</script>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  import { devtoolsPlugin } from '@scrollstackjs/devtools'

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
    plugins: import.meta.env.DEV ? [devtoolsPlugin()] : [],
  })

  onDestroy(scroll.destroy)
</script>
```

```ts [Vanilla]
import { createInfiniteScroll } from '@scrollstackjs/core'
import { devtoolsPlugin } from '@scrollstackjs/devtools'

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  plugins: import.meta.env.DEV ? [devtoolsPlugin()] : [],
})
```

:::

## Mounting it yourself

When you want to decide _where_ and _when_ the panel appears — a keyboard
shortcut, a debug route, a container other than `document.body`:

```ts
import { createDevtools } from '@scrollstackjs/devtools'

const devtools = createDevtools(engine, {
  position: 'bottom-left',
  open: true,
  maxEvents: 200,
  storageKey: 'feed-panel', // one panel per key; also the label shown on the panel
})

if (import.meta.env.DEV) devtools.mount()

// Later
devtools.toggle()
devtools.destroy() // unmounts *and* detaches from the engine
```

Every adapter exposes the engine as `engine`, so this works the same everywhere:

```ts
const { engine } = useInfiniteScroll({ ... })  // React, Vue
const { engine } = createInfiniteScroll({ ... }) // Svelte
```

## Two panels at once

One panel per `storageKey` — mounting a second with the same key evicts the
first. That is what keeps the plugin safe in React, where an engine built during a
render that React later throws away would otherwise leave a panel nobody can
destroy. For two feeds side by side, give each its own key:

```ts
plugins: [devtoolsPlugin({ storageKey: 'inbox' })]
plugins: [devtoolsPlugin({ storageKey: 'archive' })]
```

## Headless, if you want your own UI

`createDevtoolsStore` is the panel's brain without any DOM: the live snapshot, a
capped event timeline, and a `phase` label that collapses the `status` ×
`fetchStatus` matrix into the six cases worth naming — including
`loadMoreFailed`, which reads like a bug until it has a name.

```ts
import { createDevtoolsStore } from '@scrollstackjs/devtools'

const store = createDevtoolsStore(engine, { maxEvents: 50 })

store.subscribe(() => {
  const { phase, events, snapshot } = store.getSnapshot()
  console.table(events) // or render it however you like
})
```

> **Reference →** [`@scrollstackjs/devtools`](/api/devtools) for every option, and
> [Events and plugins](/examples/events) for what the timeline is built on.
