# Events & plugins

Two extension points, for two different jobs: **callbacks and events** observe
what the engine does; **plugins** package that observation into something
reusable.

## Lifecycle callbacks

The simplest hook — pass them as options:

```ts
createInfiniteScroll({
  // …
  onLoadStart: ({ pageParam }) => console.log('fetching', pageParam),
  onSuccess: ({ page, pageParam, pages }) => console.log('got', pageParam, pages.length),
  onError: ({ error, pageParam }) => report(error, { pageParam }),
})
```

`onError` fires only after the retry policy gives up — not on every failed
attempt. See [Errors & retry](/guide/errors-and-retry).

## Events

The same moments, subscribable from anywhere and unsubscribable individually.
`on()` returns its own unsubscribe function.

| Event       | Payload                      | Fires                       |
| ----------- | ---------------------------- | --------------------------- |
| `loadStart` | `{ pageParam }`              | just before a fetch begins  |
| `success`   | `{ page, pageParam, pages }` | after a page resolves       |
| `error`     | `{ error, pageParam }`       | after retries are exhausted |
| `reset`     | —                            | on `reset()`                |

```ts
const off = scroll.on('success', ({ pages }) => {
  analytics.track('page_loaded', { total: pages.length })
})

off() // stop listening
```

From an adapter, reach the engine through the `engine` escape hatch:

::: code-group

```tsx [React]
const { engine } = useInfiniteScroll({/* … */})

React.useEffect(() => engine.on('error', ({ error }) => toast.error(String(error))), [engine])
```

```vue [Vue]
<script setup lang="ts">
import { onScopeDispose } from 'vue'

const { engine } = useInfiniteScroll({/* … */})

// `on` returns its own unsubscriber, so hand it straight to the scope.
onScopeDispose(engine.on('error', ({ error }) => toast.error(String(error))))
</script>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'

  const scroll = createInfiniteScroll({ /* … */ })

  onDestroy(scroll.engine.on('error', ({ error }) => toast.error(String(error))))
  onDestroy(scroll.destroy)
</script>
```

:::

`engine` is stable for the lifetime of the component, so that effect runs once.

Note there is no event for a _retryable_ failure — only the terminal one. If you
need to observe intermediate attempts, watch `failureCount` in the snapshot.

## Plugins

A plugin is a function that receives the engine. Return a cleanup function and it
runs on `destroy()`.

```ts
import type { ScrollStackPlugin } from '@scrollstackjs/core'

const logger: ScrollStackPlugin<Page, number> = (scroll) => {
  const offStart = scroll.on('loadStart', ({ pageParam }) => console.log('→', pageParam))
  const offError = scroll.on('error', ({ error }) => console.error('✗', error))

  return () => {
    offStart()
    offError()
  }
}

createInfiniteScroll({
  // …
  plugins: [logger],
})
```

Plugins run synchronously while the engine is being created — before any fetch
can start — so a plugin never misses the first `loadStart`.

They get the full engine, which means they can drive it, not just watch it:

```ts
// Reload from scratch whenever the tab regains focus.
const refreshOnFocus: ScrollStackPlugin<Page, number> = (scroll) => {
  const onFocus = () => {
    scroll.reset()
    void scroll.loadNextPage()
  }
  window.addEventListener('focus', onFocus)
  return () => window.removeEventListener('focus', onFocus)
}
```

Guard `window` if the plugin might run on the server — core is SSR-safe, but your
plugin is your own responsibility.

## Persisting scroll state

A common plugin shape — save on success, restore on creation:

```ts
const persist =
  (key: string): ScrollStackPlugin<Page, number> =>
  (scroll) =>
    scroll.on('success', ({ pages }) => {
      sessionStorage.setItem(key, JSON.stringify(pages))
    })
```

Restoring is the harder half: there is no API to seed the engine with existing
pages, so a full "restore where I left off" plugin isn't buildable today. It's on
the roadmap as `@scrollstackjs/persist`.

## Where the line is

Plugins are the right home for analytics, logging, devtools, and side effects
that follow the lifecycle. They are the wrong home for anything that needs to
change how the engine _decides_ — retry policy, pagination, or the trigger
mechanism. Those are options and contracts, not plugins; see
[Architecture decisions](/decisions), ADR-001 and ADR-006.
