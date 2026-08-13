# @scrollstackjs/vue

A thin composable over the core engine. Vue 3.3+.

```ts
import { useInfiniteScroll } from '@scrollstackjs/vue'
```

## useInfiniteScroll

```ts
function useInfiniteScroll<TData, TPageParam = number>(
  options: InfiniteScrollOptions<TData, TPageParam>,
): UseInfiniteScrollReturn<TData, TPageParam>
```

Options are exactly [`InfiniteScrollOptions`](/api/core#infinitescrolloptions).

| Member         | Type                                                    | Description                            |
| -------------- | ------------------------------------------------------- | -------------------------------------- |
| `state`        | `ShallowRef<InfiniteScrollSnapshot<TData, TPageParam>>` | The live snapshot.                     |
| `target`       | `(el: Element \| null) => void`                         | Function ref for the sentinel.         |
| `loadNextPage` | `() => Promise<void>`                                   | Load the next page manually.           |
| `retry`        | `() => Promise<void>`                                   | Clear the error and try again.         |
| `reset`        | `() => void`                                            | Abort and return to the initial state. |
| `engine`       | `InfiniteScroll<TData, TPageParam>`                     | Escape hatch for events and plugins.   |

## `state` is a shallowRef

In templates it auto-unwraps — write `state.pages`. In `<script setup>` you need
`.value`:

```vue
<script setup lang="ts">
const { state } = useInfiniteScroll({/* … */})

const items = computed(() => state.value.pages.flatMap((p) => p.items))
</script>

<template>
  <p v-if="state.isLoading">Loading…</p>
</template>
```

A `shallowRef` is enough — and cheap — because the engine replaces the snapshot
wholesale rather than mutating it. Nothing inside a snapshot is reactive, so don't
expect `state.pages.push(…)` to do anything useful. (It won't: the array is
`readonly`.)

## `target` is a function ref

Bind it with `:ref`, not `ref`:

```vue
<div v-if="state.hasNextPage" :ref="target" />
```

`:ref="target"` passes the element to the function when it mounts and `null` when
it unmounts, which is how the observer connects and disconnects.

Vue actually calls function refs on _every_ patch, not just mount and unmount.
`target` tracks the node it already observed and no-ops on repeats — without that,
each render would build a fresh `IntersectionObserver`, which reports its initial
intersection immediately and would refetch on every render, `retry` limit and all.
Nothing to do on your side; it's why `target` must be used as-is rather than
wrapped in your own `(el) => engine.observeTarget(el)`.

## Teardown

`onScopeDispose` unsubscribes and destroys the engine, so a component that calls
this composable cleans up on unmount with no extra code. Calling it outside a
component scope (e.g. in a plain module) means nothing disposes it — call
`engine.destroy()` yourself.

## Full example

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useInfiniteScroll } from '@scrollstackjs/vue'

interface UsersPage {
  users: { id: number; name: string }[]
  nextCursor: number | null
}

const { state, target, retry, reset } = useInfiniteScroll<UsersPage, number>({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/users?cursor=${pageParam}`, { signal })).json(),
  getNextPageParam: (last) => last.nextCursor,
})

const users = computed(() => state.value.pages.flatMap((p) => p.users))
const loadMoreFailed = computed(
  () => state.value.error !== null && users.value.length > 0 && !state.value.isFetching,
)
</script>

<template>
  <main>
    <button type="button" @click="reset()">Reset</button>

    <p v-if="state.isLoading">Loading…</p>

    <div v-if="state.error !== null && users.length === 0" role="alert">
      <p>Couldn’t load users.</p>
      <button type="button" @click="retry()">Try again</button>
    </div>

    <ul>
      <li v-for="user in users" :key="user.id">{{ user.name }}</li>
    </ul>

    <div v-if="state.hasNextPage" :ref="target">
      {{ state.isFetchingNextPage ? 'Loading more…' : ' ' }}
    </div>

    <div v-if="loadMoreFailed" role="alert">
      Failed to load more.
      <button type="button" @click="retry()">Retry</button>
    </div>

    <p v-if="!state.hasNextPage && users.length > 0">That’s everyone ({{ users.length }}).</p>
  </main>
</template>
```

See `examples/vue-live-demo` in the repo — all seven features, Tailwind CSS,
real public APIs.
