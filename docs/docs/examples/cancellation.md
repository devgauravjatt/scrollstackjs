# Cancellation

The classic infinite-scroll bug is a response that lands _after_ you cleared the
list, quietly resurrecting rows the user already dismissed. ScrollStack closes
that door twice: an `AbortSignal` cancels the real network work, and a generation
counter makes any late result inert even when the fetcher ignores the signal.

Start a load in the demo and hit **Reset** before it lands. Watch what does _not_
happen: no page is appended, `failureCount` stays `0`, and no error is surfaced.

<CancelDemo />

## Forwarding the signal

The engine hands `signal` to every `fetchPage` call. Passing it on is the whole
job:

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'
import { useEffect } from 'react'

export function Feed({ query }: { query: string }) {
  const { pages, ref, reset, engine } = useInfiniteScroll({
    initialPageParam: 0,
    // `signal` aborts on reset(), destroy(), and unmount.
    fetchPage: async ({ pageParam, signal }) => {
      const response = await fetch(`/api/search?q=${query}&page=${pageParam}`, { signal })
      if (!response.ok) throw new Error(`${response.status}`)
      return response.json()
    },
    getNextPageParam: (last) => last.nextCursor,
  })

  // Options are read once, at mount — so a changed query needs an explicit reset.
  useEffect(() => {
    reset()
  }, [query, reset])

  return <List pages={pages} sentinelRef={ref} />
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { watch } from 'vue'

const props = defineProps<{ query: string }>()

const { state, target, reset } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) => {
    const response = await fetch(`/api/search?q=${props.query}&page=${pageParam}`, { signal })
    if (!response.ok) throw new Error(`${response.status}`)
    return response.json()
  },
  getNextPageParam: (last) => last.nextCursor,
})

// Aborts whatever is in flight and starts the new query from page one.
watch(
  () => props.query,
  () => reset(),
)
</script>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  export let query: string

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) => {
      const response = await fetch(`/api/search?q=${query}&page=${pageParam}`, { signal })
      if (!response.ok) throw new Error(`${response.status}`)
      return response.json()
    },
    getNextPageParam: (last) => last.nextCursor,
  })

  // Svelte re-runs this whenever `query` changes.
  $: query, scroll.reset()

  onDestroy(scroll.destroy)
</script>
```

```ts [Vanilla]
import { createInfiniteScroll } from '@scrollstackjs/core'

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) => {
    // Anything that takes an AbortSignal can be cancelled — not just fetch.
    const response = await fetch(`/api/items?page=${pageParam}`, { signal })
    if (!response.ok) throw new Error(`${response.status}`)
    return response.json()
  },
  getNextPageParam: (last) => last.nextCursor,
})

// Teardown: aborts in-flight work, disconnects observers, runs plugin cleanups.
window.addEventListener('pagehide', () => scroll.destroy())
```

:::

## What counts as a cancellation

| Action                    | In-flight request | `failureCount` | `error`           |
| ------------------------- | ----------------- | -------------- | ----------------- |
| `reset()`                 | aborted           | reset to `0`   | cleared           |
| `destroy()`               | aborted           | —              | —                 |
| A genuine network failure | —                 | `+1`           | set after retries |

An abort is **not** a failure: it doesn't count toward `retry`, doesn't emit the
`error` event, and doesn't call `onError`. If it did, switching a filter twice in
a second would exhaust the retry budget of a list that never actually failed.

::: tip Custom fetchers
If you use something other than `fetch`, wire the signal yourself — most clients
accept one (`axios`'s `signal`, `ky`, `undici`). If yours cannot, the generation
guard still protects state; you just don't get the network cancelled.
:::

> **Next →** [Manual controls](/examples/manual-controls) for `reset()` in context.
