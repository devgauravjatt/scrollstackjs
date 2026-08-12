# Tutorial

Build an infinite feed from nothing, then meet every feature and every setting —
each one running live on this page. Roughly 15 minutes end to end.

Code samples come in Vue, React, and Svelte tabs; the running demos are Vue,
because this site is a Vue app.

[[toc]]

## 1. The mental model

Three pieces, and that's the whole library:

| Piece            | What it is                                                          | You use it as                     |
| ---------------- | ------------------------------------------------------------------- | --------------------------------- |
| **The engine**   | owns pagination, retry, cancellation, the observer                  | created for you by the adapter    |
| **The snapshot** | an immutable object describing the current state                    | what you render                   |
| **The sentinel** | an element you mark; when it scrolls into view, the next page loads | a `ref` / `:ref` / `use:` binding |

There are no components and no styles anywhere in ScrollStack. You render
everything; the engine only tells you _what_ is true right now.

## 2. Your first feed

Three required options in, a snapshot and a sentinel out. That's a working
infinite feed — no error handling yet, no extra states.

<TutorialFeed />

::: code-group

```vue [Vue]
<script setup lang="ts">
import { computed } from 'vue'
import { useInfiniteScroll } from '@scrollstackjs/vue'

const { state, target } = useInfiniteScroll({
  initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
  fetchPage: async ({ pageParam, signal }) => (await fetch(pageParam, { signal })).json(),
  getNextPageParam: (last) => last.info.next,
})

const characters = computed(() => state.value.pages.flatMap((p) => p.results))
</script>

<template>
  <ul>
    <li v-for="c in characters" :key="c.id">{{ c.name }}</li>
  </ul>
  <div v-if="state.hasNextPage" :ref="target">
    {{ state.isFetching ? 'Loading…' : '' }}
  </div>
</template>
```

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'

function Feed() {
  const { pages, ref, hasNextPage, isFetching } = useInfiniteScroll({
    initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
    fetchPage: async ({ pageParam, signal }) => (await fetch(pageParam, { signal })).json(),
    getNextPageParam: (last) => last.info.next,
  })

  const characters = pages.flatMap((p) => p.results)

  return (
    <ul>
      {characters.map((c) => (
        <li key={c.id}>{c.name}</li>
      ))}
      {hasNextPage && <li ref={ref}>{isFetching ? 'Loading…' : ''}</li>}
    </ul>
  )
}
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  const scroll = createInfiniteScroll({
    initialPageParam: 'https://rickandmortyapi.com/api/character?page=1',
    fetchPage: async ({ pageParam, signal }) => (await fetch(pageParam, { signal })).json(),
    getNextPageParam: (last) => last.info.next,
  })
  const { target } = scroll
  onDestroy(scroll.destroy) // Svelte is the one adapter that can't self-clean
</script>

<ul>
  {#each $scroll.pages.flatMap((p) => p.results) as c (c.id)}
    <li>{c.name}</li>
  {/each}
  {#if $scroll.hasNextPage}
    <li use:target>{$scroll.isFetching ? 'Loading…' : ''}</li>
  {/if}
</ul>
```

:::

Three things are worth pausing on.

**`initialPageParam` can be any type.** Here it's a URL string, because that's
what this API's cursor is. It's `TPageParam` in the types — an offset number, a
page number, an opaque token, whatever your API uses.

**`signal` is handed to you, and forwarding it is the whole cancellation
contract.** One argument to `fetch`, and in-flight requests get aborted on reset.

**`getNextPageParam` returning `null` is how the list ends.** That's what flips
`hasNextPage` to `false` — and why the sentinel disappears above.

## 3. The five states you actually render

The starter above renders one state. A real feed renders five, and the ribbon
below highlights whichever one is live. Scroll it, and flip **Break it** to reach
the error branches.

<StatesDemo />

```ts
if (isLoading)       // 1. first load, no data yet        → skeleton
if (isError)         // 2. first load failed, no data     → error screen
                     // 3. rows                           → the list
if (isFetchingNextPage) // 4. a later page is in flight   → inline spinner
if (loadMoreFailed)  // 5. a later page failed            → inline retry
if (!hasNextPage)    // 6. exhausted                      → end-of-list
```

The one that trips people up is #5, because there is no `isLoadMoreError` flag.
Compose it:

```ts
const loadMoreFailed = error !== null && items.length > 0 && !isFetching
```

All three conditions matter. `error` is set on _any_ failure; `items.length > 0`
is what distinguishes it from a first-load failure; and `!isFetching` stops the
banner flickering back on during the retry itself.

::: tip Why `isError` is narrower than it looks
A load-more failure deliberately leaves `status: 'success'`. Wiping a list the
user is already reading because the _next_ page failed is a bug, so the engine
refuses to do it — see [ADR-003](/decisions).
:::

## 4. Pick your pagination

You never configure a "strategy". You write the one function that derives the
next param:

```ts
// cursor — the server tells you
getNextPageParam: (last) => last.nextCursor

// offset — a short page means the end
getNextPageParam: (page, _all, param) => (page.length === LIMIT ? param + LIMIT : null)

// page number
getNextPageParam: (_last, _all, param) => (param < totalPages ? param + 1 : null)
```

::: warning `0` is a valid page param
The engine checks `== null`, never truthiness. Writing `param || null` silently
ends the list at offset `0`. Use `?? null`.
:::

All three run side by side against three different real APIs on the
[demo page](/demo#pagination-is-one-function).

## 5. Every setting, live

Below is the complete option surface. Move a control and the engine is rebuilt
with the config shown at the bottom — because **options are read once, when the
engine is created**. Changing them later does nothing until you remount or
`reset()`, which is exactly what this playground does for you.

<Playground />

### Observer settings

| Option       | Default | What it does                                                                                                                            |
| ------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `autoLoad`   | `true`  | Whether intersection loads a page at all. Turn it off for button-driven pagination — the observer stays attached, it just stops firing. |
| `root`       | `null`  | The element intersection is measured against. `null` is the viewport. Set it when your list scrolls inside a box.                       |
| `rootMargin` | —       | Grows (or shrinks) the root box: `'top right bottom left'`. `'0px 0px 400px 0px'` starts loading 400px before the bottom edge.          |
| `threshold`  | —       | How much of the sentinel must be visible, `0`–`1`. Leave it alone unless the sentinel is large.                                         |

Turn **root** off in the playground and the box stops auto-loading until you
scroll the _page_ — with `root: null` the engine measures against the window, and
your scroll box isn't the window. That's the whole reason `root` exists.

`rootMargin` only means what you want when `root` is the thing that scrolls.
Against the viewport, "400px before the bottom" means the bottom of the _window_.

### Retry settings

| Option       | Default     | What it does                                                                                                             |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `retry`      | `3`         | `number` — try N more times. `false` — never. `true` — forever. `(failureCount, error) => boolean` — decide per failure. |
| `retryDelay` | exponential | `min(1000 * 2 ** (attempt - 1), 30_000)`: 1s, 2s, 4s… capped at 30s. Or a number, or a function.                         |

Watch the sentinel while retries run: `failureCount` climbs but `error` stays
`null`. The error is only surfaced once the policy gives up. Set `retry` to `0`
in the playground and the failure appears instantly.

The most useful non-default is a policy that doesn't waste attempts on responses
that will never change:

```ts
retry: (failureCount, error) => {
  if (error instanceof HttpError && error.status < 500) return false // 404 won't fix itself
  return failureCount <= 3
}
```

### The three required options

| Option             | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `initialPageParam` | The param for the very first fetch. Any type.                      |
| `fetchPage`        | `({ pageParam, signal }) => TData \| Promise<TData>`. May be sync. |
| `getNextPageParam` | Derives the next param; `null`/`undefined` ends the list.          |

Missing any of them throws `ScrollStackError` immediately, at creation — these
are programming errors, not fetch failures, so they never appear in `error`.

## 6. Driving it yourself

Four controls, all in the playground's toolbar:

| Control          | Behavior                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `loadNextPage()` | Loads the next page. **No-ops** while a fetch is in flight or once exhausted — a bare button needs no guard.          |
| `retry()`        | Clears `failureCount` and `error`, then fetches again. Resumes from the page that failed; loaded pages are untouched. |
| `reset()`        | Aborts anything in flight and returns to the initial state.                                                           |
| `destroy()`      | Full teardown. React and Vue call it for you; **Svelte doesn't** — use `onDestroy(scroll.destroy)`.                   |

## 7. Watching what happens

Three overlapping ways in, smallest first.

**Callbacks**, when you just want a hook:

```ts
useInfiniteScroll({
  // …
  onLoadStart: ({ pageParam }) => {},
  onSuccess: ({ page, pageParam, pages }) => {},
  onError: ({ error, pageParam }) => {}, // only after retries are exhausted
})
```

**Events**, when the listener lives elsewhere and needs to unsubscribe:

```ts
const off = engine.on('success', ({ pages }) => track(pages.length))
```

**Plugins**, when you want to package that up and reuse it. A plugin is a
function that receives the engine and returns a cleanup — the event log in the
playground is one:

```ts
const recorder: ScrollStackPlugin<Page, string> = (engine) => {
  const offs = [
    engine.on('loadStart', () => log('loadStart')),
    engine.on('success', ({ pages }) => log(`success · ${pages.length}`)),
  ]
  return () => offs.forEach((off) => off()) // runs on destroy()
}

useInfiniteScroll({ /* … */, plugins: [recorder] })
```

Plugins run at creation, before any fetch can start, so they never miss the first
`loadStart`. There's no event for a _retryable_ failure — only the terminal one;
watch `failureCount` if you need the attempts.

## 8. Things that will bite you

- **Options are read once.** Change `fetchPage`, `root`, or anything else and the
  engine won't notice. Remount with a `key`, or call `reset()`.
- **`root` must exist before the hook runs.** A ref isn't populated on first
  render, so the component calling the hook has to mount _inside_ an
  already-rendered container. See [Horizontal & scoped scrolling](/guide/horizontal).
- **The sentinel needs layout size.** Zero-height (or zero-width, in a rail)
  never intersects anything.
- **IntersectionObserver only fires on transitions.** If a loaded page doesn't
  push the sentinel back out of view, nothing re-triggers. Load enough per page,
  or call `loadNextPage()` yourself.
- **`fetch` doesn't reject on 404.** Check `res.ok` and throw, or the engine
  stores the error page as data.
- **Nothing hydrates server-fetched pages.** There's no `initialPages` option
  yet — see [Server rendering](/guide/ssr) for the workaround.

## Where next

- [Live demo](/demo) — the same features as standalone demos, plus horizontal,
  cancellation, and three pagination strategies against three real APIs.
- [API reference](/api/core) — every type and method.
- [Architecture decisions](/decisions) — why the engine is shaped this way.
