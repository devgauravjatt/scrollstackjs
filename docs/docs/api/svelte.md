# @scrollstackjs/svelte

A store wrapper over the core engine. Svelte 4 and 5 — the adapter imports no
Svelte runtime, only the `Readable` type, so it works with both.

```ts
import { createInfiniteScroll } from '@scrollstackjs/svelte'
```

## createInfiniteScroll

```ts
function createInfiniteScroll<TData, TPageParam = number>(
  options: InfiniteScrollOptions<TData, TPageParam>,
): ScrollStore<TData, TPageParam>
```

Options are exactly [`InfiniteScrollOptions`](/api/core#infinitescrolloptions).

The return value **is** a Svelte store — `$scroll` is the
[snapshot](/api/core#infinitescrollsnapshot) — with extra members hanging off it:

| Member         | Type                                     | Description                            |
| -------------- | ---------------------------------------- | -------------------------------------- |
| `subscribe`    | `Readable<Snapshot>['subscribe']`        | The store contract. Use `$scroll`.     |
| `target`       | `(node: Element) => { destroy(): void }` | Svelte action for the sentinel.        |
| `loadNextPage` | `() => Promise<void>`                    | Load the next page manually.           |
| `retry`        | `() => Promise<void>`                    | Clear the error and try again.         |
| `reset`        | `() => void`                             | Abort and return to the initial state. |
| `destroy`      | `() => void`                             | Full teardown. **You must call this.** |
| `engine`       | `InfiniteScroll<TData, TPageParam>`      | Escape hatch for events and plugins.   |

## Teardown is manual

This is the one adapter that can't clean up after itself — a store has no
component lifecycle to hook. Wire it explicitly:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte'
  const scroll = createInfiniteScroll({ /* … */ })
  onDestroy(scroll.destroy)
</script>
```

Skip it and the engine keeps its subscriptions and any in-flight request alive
after the component is gone.

## `target` is an action

```svelte
{#if $scroll.hasNextPage}
  <div use:target />
{/if}
```

Destructure it first (`const { target } = scroll`) — `use:scroll.target` is not
valid action syntax.

The action's own `destroy` disconnects the observer when the element leaves the
DOM, which is what makes the `{#if}` above safe.

## Full example

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  interface UsersPage {
    users: { id: number; name: string }[]
    nextCursor: number | null
  }

  const scroll = createInfiniteScroll<UsersPage, number>({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) =>
      (await fetch(`/api/users?cursor=${pageParam}`, { signal })).json(),
    getNextPageParam: (last) => last.nextCursor,
  })
  const { target, retry, reset } = scroll
  onDestroy(scroll.destroy)

  $: users = $scroll.pages.flatMap((p) => p.users)
  $: loadMoreFailed = $scroll.error !== null && users.length > 0 && !$scroll.isFetching
</script>

<main>
  <button type="button" on:click={reset}>Reset</button>

  {#if $scroll.isLoading}
    <p>Loading…</p>
  {/if}

  {#if $scroll.error !== null && users.length === 0}
    <div role="alert">
      <p>Couldn’t load users.</p>
      <button type="button" on:click={retry}>Try again</button>
    </div>
  {/if}

  <ul>
    {#each users as user (user.id)}
      <li>{user.name}</li>
    {/each}
  </ul>

  {#if $scroll.hasNextPage}
    <div use:target>{$scroll.isFetchingNextPage ? 'Loading more…' : ' '}</div>
  {/if}

  {#if loadMoreFailed}
    <div role="alert">
      Failed to load more.
      <button type="button" on:click={retry}>Retry</button>
    </div>
  {/if}

  {#if !$scroll.hasNextPage && users.length > 0}
    <p>That’s everyone ({users.length}).</p>
  {/if}
</main>
```

This is `examples/svelte-infinite-feed` in the repo, near-verbatim. The reactive
statements are Svelte 4 syntax; under Svelte 5 runes they become
`$derived(...)` — the store itself works either way.

## Svelte 5 note

`$scroll` auto-subscription still works in runes mode, so nothing here changes.
If you'd rather hold the snapshot in a rune, subscribe manually:

```svelte
<script lang="ts">
  let snapshot = $state(scroll.engine.getSnapshot())
  $effect(() => scroll.engine.subscribe(() => (snapshot = scroll.engine.getSnapshot())))
</script>
```
