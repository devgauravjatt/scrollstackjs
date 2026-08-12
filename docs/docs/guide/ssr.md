# Server rendering

The engine constructs and runs with no DOM. Nothing in core touches `window` or
`document` at module scope, and `IntersectionObserver` is feature-detected rather
than assumed.

## What happens on the server

```ts
const scroll = createInfiniteScroll({/* … */})

scroll.getSnapshot().isIdle // true
scroll.getSnapshot().pages // []
scroll.observeTarget(el) // no-op — no observer exists to create
```

`createIntersectionTrigger` returns `null` when `IntersectionObserver` is
undefined, and the engine treats a null trigger as "no automatic loading". So the
server renders the idle snapshot, the client hydrates onto the identical markup,
and loading begins when the sentinel first intersects.

`loadNextPage()` still works server-side — it's just an async function. That's the
seam you'd use to prefetch, though see the limitation below.

## Per framework

**React** passes `getSnapshot` as `useSyncExternalStore`'s third argument (the
server snapshot). Because snapshots are referentially stable, the server and the
first client render produce the same value, so there's no hydration mismatch.

**Vue** creates the engine and seeds a `shallowRef` with the idle snapshot;
`onScopeDispose` handles teardown. Works under `renderToString` unchanged.

**Svelte** subscribes eagerly (the store contract calls `run` immediately with the
current value), so SSR renders the idle snapshot. Remember `onDestroy(scroll.destroy)`
on the client.

## Render the loading state, not nothing

Since the server always renders `isIdle`, design that state deliberately —
skeleton rows sized like real ones — or your page will ship a blank first paint
and jump when the client fetches.

::: code-group

```tsx [React]
if (isIdle || isLoading) return <SkeletonRows count={10} />
```

```vue [Vue]
<SkeletonRows v-if="state.isIdle || state.isLoading" :count="10" />
```

```svelte [Svelte]
{#if $scroll.isIdle || $scroll.isLoading}
  <SkeletonRows count={10} />
{/if}
```

:::

Note that `isIdle` (no fetch started) and `isLoading` (first fetch in flight) are
distinct. On the server you only ever see `isIdle`.

## Limitation: no hydration of prefetched pages

There is **no `initialPages` / `initialData` option** today. You cannot fetch page
one on the server and hand it to the engine — the client always starts from
`idle` and fetches for itself.

If the first page must be server-rendered, render it outside ScrollStack and let
the engine take over from page two:

::: code-group

```tsx [React]
// Page one comes from the server as a prop; the engine paginates onward.
function Feed({ firstPage }: { firstPage: Page }) {
  const { pages, ref, hasNextPage } = useInfiniteScroll({
    initialPageParam: firstPage.nextCursor, // start where the server stopped
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
  })

  const items = [...firstPage.items, ...pages.flatMap((p) => p.items)]
  // …
}
```

```vue [Vue]
<!-- Page one comes from the server as a prop; the engine paginates onward. -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ firstPage: Page }>()

const { state, target } = useInfiniteScroll({
  initialPageParam: props.firstPage.nextCursor, // start where the server stopped
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
})

const items = computed(() => [
  ...props.firstPage.items,
  ...state.value.pages.flatMap((p) => p.items),
])
</script>
```

```svelte [Svelte]
<!-- Page one comes from the server as a prop; the engine paginates onward. -->
<script lang="ts">
  import { onDestroy } from 'svelte'

  export let firstPage: Page

  const scroll = createInfiniteScroll({
    initialPageParam: firstPage.nextCursor, // start where the server stopped
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
  })
  const { target } = scroll
  onDestroy(scroll.destroy)

  $: items = [...firstPage.items, ...$scroll.pages.flatMap((p) => p.items)]
</script>
```

:::

Guard the case where `firstPage.nextCursor` is already `null` — there's nothing
left to paginate, so don't render the sentinel.

Initial-page hydration is on the roadmap; `STATUS.md` tracks it.

## Static generation

Nothing special is required. The engine is inert until an element intersects, so
a statically generated page ships the idle snapshot and starts working as soon as
it hydrates.
