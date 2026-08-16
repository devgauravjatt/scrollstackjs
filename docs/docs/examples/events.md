# Events and plugins

Four lifecycle events — `loadStart`, `success`, `error`, `reset` — and a plugin
system that turns them into behavior. Analytics, logging, persistence, and the
devtools timeline are all built on nothing more than this.

The log in the demo is written by a real plugin, not by the component.

<EventsDemo />

## Subscribing to events

`on()` returns an unsubscribe function, so cleanup is always the return value.

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'
import { useEffect } from 'react'

export function Feed() {
  const { pages, ref, engine } = useInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
  })

  useEffect(() => {
    const off = [
      engine.on('loadStart', ({ pageParam }) => analytics.track('feed_page_start', { pageParam })),
      engine.on('success', ({ pageParam, pages }) =>
        analytics.track('feed_page_loaded', { pageParam, total: pages.length }),
      ),
      engine.on('error', ({ error, pageParam }) => reportError(error, { pageParam })),
    ]
    return () => off.forEach((unsubscribe) => unsubscribe())
  }, [engine])

  return <List pages={pages} sentinelRef={ref} />
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { onScopeDispose } from 'vue'

const { state, target, engine } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
})

const off = [
  engine.on('loadStart', ({ pageParam }) => analytics.track('feed_page_start', { pageParam })),
  engine.on('error', ({ error, pageParam }) => reportError(error, { pageParam })),
]

onScopeDispose(() => off.forEach((unsubscribe) => unsubscribe()))
</script>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
  })

  const off = [
    scroll.engine.on('loadStart', ({ pageParam }) =>
      analytics.track('feed_page_start', { pageParam }),
    ),
    scroll.engine.on('error', ({ error }) => reportError(error)),
  ]

  onDestroy(() => {
    off.forEach((unsubscribe) => unsubscribe())
    scroll.destroy()
  })
</script>
```

```ts [Vanilla]
import { createInfiniteScroll } from '@scrollstackjs/core'

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
})

const stop = scroll.on('success', ({ pageParam, pages }) => {
  console.info(`page ${pageParam} landed — ${pages.length} held`)
})

// Later: stop()
```

:::

## Writing a plugin

A plugin is a function that receives the engine and optionally returns a cleanup,
which runs on `destroy()`. Registering it in `plugins` means it is attached
_before_ the first fetch, so nothing is missed — the difference between a plugin
and an `on()` call in an effect.

```ts
import type { ScrollStackPlugin } from '@scrollstackjs/core'

/** Reports how long each page took, and how many are held. */
export function timingPlugin<TData, TPageParam>(): ScrollStackPlugin<TData, TPageParam> {
  return (engine) => {
    const started = new Map<TPageParam, number>()

    const off = [
      engine.on('loadStart', ({ pageParam }) => started.set(pageParam, performance.now())),
      engine.on('success', ({ pageParam, pages }) => {
        const at = started.get(pageParam)
        if (at !== undefined) {
          analytics.track('page_timing', { ms: performance.now() - at, held: pages.length })
          started.delete(pageParam)
        }
      }),
      engine.on('reset', () => started.clear()),
    ]

    // Returned cleanup runs on engine.destroy().
    return () => off.forEach((unsubscribe) => unsubscribe())
  }
}
```

Then register it wherever the engine is created:

```ts
useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  plugins: [timingPlugin()],
})
```

## Events versus callbacks

The same three moments are available as options, if one listener is all you need:

```ts
useInfiniteScroll({
  // ...
  onLoadStart: ({ pageParam }) => {},
  onSuccess: ({ page, pageParam, pages }) => {},
  onError: ({ error, pageParam }) => {},
})
```

| Use            | When                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `onSuccess`, … | One consumer, defined where the engine is created.                        |
| `on()`         | Several consumers, or subscribing after the fact.                         |
| A plugin       | Reusable behavior you want attached before the first fetch, with cleanup. |

::: warning `error` fires once, after retries
The `error` event is emitted when the retry policy gives up, not on each failed
attempt. Watch `failureCount` on the snapshot if you want the attempts themselves.
An abort is not a failure and emits nothing at all.
:::

> **Reference →** [Events & plugins guide](/guide/events-and-plugins) and
> [`@scrollstackjs/core`](/api/core) for the event payloads.
