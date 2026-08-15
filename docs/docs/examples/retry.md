# Errors and retry

Two failures need two different behaviors, and conflating them is the most common
infinite-scroll bug:

- **The first page fails.** There is nothing to show. `status` becomes `'error'`.
- **A later page fails.** The rows you already loaded are still perfectly good.
  `status` stays `'success'` and `error` is set beside it (ADR-003).

Flip the toggle in the demo and scroll: the engine retries on a backoff, then
gives up — and the list never empties.

<RetryDemo />

## Rendering both cases

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'

export function Feed() {
  const { pages, ref, error, isLoading, isError, isFetching, hasNextPage, retry } =
    useInfiniteScroll({
      initialPageParam: 0,
      fetchPage,
      getNextPageParam: (last) => last.nextCursor,
      retry: 2, // default is 3
      retryDelay: (attempt) => Math.min(1000 * 2 ** (attempt - 1), 30_000), // the default
    })

  // The load-more failure: an error, but with data still on screen.
  const loadMoreFailed = error !== null && pages.length > 0 && !isFetching

  if (isLoading) return <Skeleton />
  if (isError) return <ErrorState error={error} onRetry={retry} />

  return (
    <ul>
      {pages
        .flatMap((page) => page.items)
        .map((item) => (
          <Row key={item.id} {...item} />
        ))}

      {loadMoreFailed ? (
        <li>
          Couldn’t load more. <button onClick={retry}>Try again</button>
        </li>
      ) : (
        hasNextPage && <li ref={ref} />
      )}
    </ul>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

const { state, target, retry } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  retry: 2,
})

const items = computed(() => state.value.pages.flatMap((page) => page.items))

const loadMoreFailed = computed(
  () => state.value.error !== null && state.value.pages.length > 0 && !state.value.isFetching,
)
</script>

<template>
  <Skeleton v-if="state.isLoading" />
  <ErrorState v-else-if="state.isError" :error="state.error" @retry="retry()" />

  <ul v-else>
    <Row v-for="item in items" :key="item.id" v-bind="item" />

    <li v-if="loadMoreFailed">Couldn’t load more. <button @click="retry()">Try again</button></li>
    <li v-else-if="state.hasNextPage" :ref="target" />
  </ul>
</template>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
    retry: 2,
  })

  const { target, retry } = scroll
  onDestroy(scroll.destroy)

  $: loadMoreFailed = $scroll.error !== null && $scroll.pages.length > 0 && !$scroll.isFetching
</script>

{#if $scroll.isLoading}
  <Skeleton />
{:else if $scroll.isError}
  <ErrorState error={$scroll.error} on:retry={retry} />
{:else}
  <ul>
    {#each $scroll.pages.flatMap((page) => page.items) as item (item.id)}
      <Row {...item} />
    {/each}

    {#if loadMoreFailed}
      <li>Couldn’t load more. <button on:click={retry}>Try again</button></li>
    {:else if $scroll.hasNextPage}
      <li use:target />
    {/if}
  </ul>
{/if}
```

```ts [Vanilla]
import { createInfiniteScroll } from '@scrollstackjs/core'

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  retry: (failureCount, error) => {
    // Don't burn retries on a request that will never succeed.
    if (error instanceof Response && error.status === 404) return false
    return failureCount < 3
  },
})

scroll.subscribe(() => {
  const { pages, error, isFetching, isError } = scroll.getSnapshot()
  const loadMoreFailed = error !== null && pages.length > 0 && !isFetching

  banner.hidden = !loadMoreFailed
  fatal.hidden = !isError
})

retryButton.addEventListener('click', () => scroll.retry())
```

:::

## The one line to remember

```ts
const loadMoreFailed = error !== null && pages.length > 0 && !isFetching
```

`isError` alone will not tell you this — by design. `status` stays `'success'`
because your rows are still valid, so a naive `if (isError)` branch would never
fire and the failure would be invisible.

## Retry settings

| Option       | Type                                                    | Default                                  |
| ------------ | ------------------------------------------------------- | ---------------------------------------- |
| `retry`      | `boolean \| number \| (failureCount, error) => boolean` | `3`                                      |
| `retryDelay` | `number \| (failureCount, error) => number`             | `min(1000 * 2 ** (attempt - 1), 30_000)` |

`failureCount` climbs while the automatic retries run, and `error` stays `null`
until they are exhausted — so a spinner that watches `error` doesn't flicker
mid-backoff. `retry()` clears both and resumes **from the page that failed**;
nothing already loaded is refetched.

Aborts are not failures. A request cancelled by `reset()`, `destroy()`, or a newer
fetch doesn't increment `failureCount` and doesn't emit `error` (ADR-005).

> **Reference →** [Errors & retry guide](/guide/errors-and-retry) for the full
> state matrix, and [Cancellation](/examples/cancellation) for the abort path.
