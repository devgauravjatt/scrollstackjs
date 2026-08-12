# Errors & retry

## A load-more failure keeps your data

This is the rule that shapes the error API. There are two kinds of failure and
they must not render the same way:

| Failure           | `status`    | `error` | What the user should see                      |
| ----------------- | ----------- | ------- | --------------------------------------------- |
| First load failed | `'error'`   | set     | An error screen — there's no data             |
| Page 7 failed     | `'success'` | set     | The six loaded pages, plus a retry affordance |

Wiping a list the user is already reading because the _next_ page failed is a
bug, so the engine refuses to do it. `isError` is therefore narrower than it
looks: it means the first load failed and there is nothing to show.

Detect the other case explicitly:

```ts
const loadMoreFailed = error !== null && pages.length > 0 && !isFetching
```

All three conditions matter: `error` is cleared when the next attempt starts, so
without `!isFetching` the banner flickers back on during the retry itself.

::: code-group

```tsx [React]
{
  isLoading && <Spinner />
}

{
  isError && <ErrorScreen onRetry={() => void retry()} />
}

;<ul>
  {items.map((item) => (
    <Row key={item.id} {...item} />
  ))}
</ul>

{
  loadMoreFailed && (
    <div role="alert">
      Failed to load more. <button onClick={() => void retry()}>Retry</button>
    </div>
  )
}
```

```vue [Vue]
<script setup lang="ts">
const { state, retry } = useInfiniteScroll({/* … */})

const items = computed(() => state.value.pages.flatMap((p) => p.items))
const loadMoreFailed = computed(
  () => state.value.error !== null && items.value.length > 0 && !state.value.isFetching,
)
</script>

<template>
  <Spinner v-if="state.isLoading" />
  <ErrorScreen v-else-if="state.isError" @retry="retry" />

  <ul>
    <Row v-for="item in items" :key="item.id" v-bind="item" />
  </ul>

  <div v-if="loadMoreFailed" role="alert">
    Failed to load more. <button type="button" @click="retry">Retry</button>
  </div>
</template>
```

```svelte [Svelte]
<script lang="ts">
  const scroll = createInfiniteScroll({ /* … */ })
  const { retry } = scroll

  $: items = $scroll.pages.flatMap((p) => p.items)
  $: loadMoreFailed = $scroll.error !== null && items.length > 0 && !$scroll.isFetching
</script>

{#if $scroll.isLoading}
  <Spinner />
{:else if $scroll.isError}
  <ErrorScreen on:retry={retry} />
{/if}

<ul>
  {#each items as item (item.id)}
    <Row {...item} />
  {/each}
</ul>

{#if loadMoreFailed}
  <div role="alert">
    Failed to load more.
    <button type="button" on:click={retry}>Retry</button>
  </div>
{/if}
```

:::

## Automatic retry

Failed fetches retry automatically before `error` is ever surfaced. Defaults:

- **`retry: 3`** — up to three retries.
- **`retryDelay`** — exponential backoff, `min(1000 * 2 ** (attempt - 1), 30_000)`:
  1s, 2s, 4s, 8s… capped at 30s.

`failureCount` increments as attempts fail, so you can show a "retrying…"
affordance while it climbs. `error` is only set once the policy gives up.

```ts
createInfiniteScroll({
  // …
  retry: 5,
  retryDelay: 2000,
})
```

Both accept a function, which is how you make the policy depend on the error:

```ts
createInfiniteScroll({
  // …
  // Don't burn retries on a 404 — it will fail identically every time.
  retry: (failureCount, error) => {
    if (error instanceof HttpError && error.status < 500) return false
    return failureCount <= 3
  },
  retryDelay: (failureCount) => Math.min(500 * 2 ** failureCount, 10_000),
})
```

`failureCount` is `1` on the first failure. `retry: false` disables automatic
retries entirely; `retry: true` retries forever.

## Manual retry

`retry()` clears `failureCount` and `error`, then fetches again — it's what you
wire to a "Try again" button. It resumes from the page that failed; successful
pages are untouched.

```ts
<button onClick={() => void retry()}>Try again</button>
```

`loadNextPage()` is the plain "load the next page" control. It no-ops while a
fetch is in flight or when `hasNextPage` is false, so it's safe to call from a
button _and_ have the observer running.

## Cancellations aren't failures

When `reset()` or `destroy()` aborts an in-flight request, the engine treats it
as a cancellation: no `failureCount` increment, no `error`, no `error` event.
State returns to `idle` (or stays `success` if pages are already loaded).

Forward the signal so the abort reaches the network:

```ts
fetchPage: async ({ pageParam, signal }) => {
  const res = await fetch(`/api/items?cursor=${pageParam}`, { signal })
  if (!res.ok) throw new HttpError(res.status) // throw so retry can see it
  return res.json()
}
```

Note that `fetch` only rejects on network failure — a 500 resolves normally. If
you don't check `res.ok`, the engine will happily treat an error page as data.

## Errors thrown by ScrollStack itself

Misuse throws `ScrollStackError` — a missing `fetchPage`, a missing
`getNextPageParam`, no `initialPageParam`, or handing `observeTarget` something
that isn't an `Element`. These are programming errors, thrown synchronously at
setup; they don't flow through `status` or the retry machinery.

```ts
import { ScrollStackError } from '@scrollstackjs/core'

try {
  createInfiniteScroll(options)
} catch (error) {
  if (error instanceof ScrollStackError) {
    /* your config is wrong */
  }
}
```

## Observing failures

`onError` fires only after retries are exhausted — the same moment `error` is
set:

```ts
createInfiniteScroll({
  // …
  onError: ({ error, pageParam }) => {
    telemetry.record('scroll_page_failed', { pageParam, error })
  },
})
```

The `error` event carries the same payload; see
[Events & plugins](/guide/events-and-plugins).
