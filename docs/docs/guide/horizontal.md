# Horizontal & scoped scrolling

Nothing about the engine is vertical. A carousel, a rail, or any list that scrolls
inside an `overflow` container uses the same hook — what changes is _where the
sentinel lives_ and _what the observer measures against_.

|                   | Vertical page feed                     | Horizontal rail                        |
| ----------------- | -------------------------------------- | -------------------------------------- |
| Sentinel position | bottom of the list                     | right edge of the track                |
| `root`            | the viewport (default)                 | the scroll container                   |
| `rootMargin`      | `'0px 0px 400px 0px'` (prefetch below) | `'0px 400px 0px 0px'` (prefetch ahead) |
| Sentinel size     | needs height                           | needs **width**                        |

## Why `root` matters

A sentinel inside an `overflow-x` box already works with the default viewport
root — ancestors clip the target's rect, so a sentinel scrolled off the end of the
rail isn't intersecting.

The reason to set `root` anyway is `rootMargin`. Against the viewport, a
right-hand margin means "before the right edge of the _window_", which is not
where your rail ends. Only when `root` **is** the rail does
`rootMargin: '0px 320px 0px 0px'` mean what you want: start the next page 320px
before the user reaches the end of the track.

```ts
useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  root: railElement, // measure against the rail
  rootMargin: '0px 320px 0px 0px', // top right bottom left
})
```

## The mounting problem

Options are read **once**, when the engine is created. So `root` has to exist
_before_ the hook runs — and a ref to a DOM node isn't populated on first render.

Split the component in two: a parent that renders the scroll container, and a
child, mounted inside it, that owns the hook.

::: code-group

```tsx [React]
function Rail() {
  // A state setter as the ref — unlike useRef, this re-renders once the node
  // exists, which is what lets <Track> mount with `root` already pointing at it.
  const [viewport, setViewport] = React.useState<HTMLElement | null>(null)

  return (
    <div ref={setViewport} style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
      {viewport !== null && <Track root={viewport} />}
    </div>
  )
}

function Track({ root }: { root: Element }) {
  const { pages, ref, hasNextPage, isFetchingNextPage } = useInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
    root,
    rootMargin: '0px 320px 0px 0px',
  })

  return (
    <>
      {pages
        .flatMap((p) => p.photos)
        .map((photo) => (
          <Card key={photo.id} {...photo} style={{ flex: '0 0 180px' }} />
        ))}
      {hasNextPage && (
        <div ref={ref} style={{ flex: '0 0 180px' }}>
          {isFetchingNextPage ? 'Loading more…' : ''}
        </div>
      )}
    </>
  )
}
```

```vue [Vue]
<!-- Rail.vue — the parent owns the scroll container -->
<script setup lang="ts">
import { ref } from 'vue'
import Track from './Track.vue'

// Template refs are reactive, so the v-if flips once the node exists — which is
// what lets <Track> mount with `root` already pointing at it.
const viewport = ref<HTMLElement | null>(null)
</script>

<template>
  <div ref="viewport" style="display: flex; gap: 12px; overflow-x: auto">
    <Track v-if="viewport" :root="viewport" />
  </div>
</template>
```

```vue [Vue — child]
<!-- Track.vue — the child owns the engine -->
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'

const props = defineProps<{ root: Element }>()

const { state, target } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  root: props.root,
  rootMargin: '0px 320px 0px 0px',
})
</script>

<template>
  <Card
    v-for="photo in state.pages.flatMap((p) => p.photos)"
    :key="photo.id"
    v-bind="photo"
    style="flex: 0 0 180px"
  />
  <div v-if="state.hasNextPage" :ref="target" style="flex: 0 0 180px">
    {{ state.isFetchingNextPage ? 'Loading more…' : '' }}
  </div>
</template>
```

```svelte [Svelte]
<!-- Rail.svelte — the parent owns the scroll container -->
<script lang="ts">
  import Track from './Track.svelte'

  // `bind:this` assigns after mount and is reactive, so the {#if} flips once the
  // node exists and <Track> mounts with `root` already pointing at it.
  let viewport: HTMLElement | undefined
</script>

<div bind:this={viewport} style="display: flex; gap: 12px; overflow-x: auto">
  {#if viewport}
    <Track root={viewport} />
  {/if}
</div>
```

```svelte [Svelte — child]
<!-- Track.svelte — the child owns the engine -->
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'

  export let root: Element

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
    root,
    rootMargin: '0px 320px 0px 0px',
  })
  const { target } = scroll
  onDestroy(scroll.destroy)
</script>

{#each $scroll.pages.flatMap((p) => p.photos) as photo (photo.id)}
  <Card {...photo} style="flex: 0 0 180px" />
{/each}

{#if $scroll.hasNextPage}
  <div use:target style="flex: 0 0 180px">
    {$scroll.isFetchingNextPage ? 'Loading more…' : ''}
  </div>
{/if}
```

:::

## Sizing rules

- **The sentinel needs real width.** `flex: 0 0 180px`, not a bare `<div/>` — a
  zero-width flex item never intersects anything.
- **A page must overflow the rail.** IntersectionObserver fires on _transitions_.
  If a loaded page doesn't push the sentinel back out of the root, nothing
  re-triggers. Wide cards and a reasonable page size handle this; otherwise call
  `loadNextPage()` after a load until `hasNextPage` is false.
- **`overflow-y: hidden`** on the track avoids a stray vertical scrollbar
  changing the container's height mid-load.

`scroll-snap-type: x proximity` on the container with `scroll-snap-align: start`
on the cards is a nice touch and doesn't interfere with the observer.

## Resetting a rail

Since the engine lives in the child, a "start over" button in the parent has two
good options — the documented remount (`key` / `{#key}`), or lifting `reset()` up:

::: code-group

```tsx [React]
const [generation, setGeneration] = React.useState(0)

const reset = () => {
  viewport?.scrollTo({ left: 0 }) // scroll position isn't engine state
  setGeneration((n) => n + 1) // remount -> fresh engine
}

;<Track key={generation} root={viewport} />
```

```vue [Vue]
<script setup lang="ts">
const generation = ref(0)

const reset = () => {
  viewport.value?.scrollTo({ left: 0 }) // scroll position isn't engine state
  generation.value++ // remount -> fresh engine
}
</script>

<template>
  <Track :key="generation" :root="viewport" />
</template>
```

```svelte [Svelte]
<script lang="ts">
  let generation = 0

  const reset = () => {
    viewport?.scrollTo({ left: 0 }) // scroll position isn't engine state
    generation += 1                 // remount -> fresh engine
  }
</script>

{#key generation}
  <Track root={viewport} />
{/key}
```

:::

Remounting is the documented escape hatch for any option change, not just `root`
— see [Core concepts](/guide/concepts).

## Vertical containers

Everything above applies unchanged to a vertically scrolling `<div>` that isn't
the page: set `root` to it and put the margin on the bottom
(`'0px 0px 400px 0px'`). Modal bodies and chat panes are the usual cases.
