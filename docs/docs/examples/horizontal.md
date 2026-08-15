# Horizontal rail

Nothing about the engine is vertical. A carousel is the same hook with the
sentinel at the right edge of the track — what changes is `root` (what the
observer measures against) and which side `rootMargin` prefetches on.

<RailDemo />

## The code

Note the split into two components. Options are read once, at mount, so `root`
has to point at an element that _already exists_ — which means the component
holding the hook must mount inside the container, not alongside it.

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'
import { useState } from 'react'

export function Rail() {
  // A state setter as the ref, not useRef — this re-renders once the node exists,
  // which is what lets <Track> mount with `root` already pointing at it.
  const [viewport, setViewport] = useState<HTMLElement | null>(null)

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
    rootMargin: '0px 320px 0px 0px', // top right bottom left — prefetch ahead
  })

  return (
    <>
      {pages
        .flatMap((page) => page.photos)
        .map((photo) => (
          <Card key={photo.id} {...photo} style={{ flex: '0 0 180px' }} />
        ))}

      {/* A sentinel in a flex row needs real width, or it never intersects. */}
      {hasNextPage && (
        <div ref={ref} style={{ flex: '0 0 180px' }}>
          {isFetchingNextPage ? 'Loading…' : ''}
        </div>
      )}
    </>
  )
}
```

```vue [Vue]
<!-- Rail.vue -->
<script setup lang="ts">
import { ref } from 'vue'

import Track from './Track.vue'

const viewport = ref<HTMLElement | null>(null)
</script>

<template>
  <div ref="viewport" style="display: flex; gap: 12px; overflow-x: auto">
    <Track v-if="viewport" :root="viewport" />
  </div>
</template>

<!-- Track.vue -->
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { computed } from 'vue'

const props = defineProps<{ root: Element }>()

const { state, target } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  root: props.root,
  rootMargin: '0px 320px 0px 0px',
})

const photos = computed(() => state.value.pages.flatMap((page) => page.photos))
</script>

<template>
  <Card v-for="photo in photos" :key="photo.id" v-bind="photo" style="flex: 0 0 180px" />
  <div v-if="state.hasNextPage" :ref="target" style="flex: 0 0 180px">
    {{ state.isFetchingNextPage ? 'Loading…' : '' }}
  </div>
</template>
```

```svelte [Svelte]
<!-- Rail.svelte -->
<script lang="ts">
  import Track from './Track.svelte'

  let viewport: HTMLElement
</script>

<div bind:this={viewport} style="display: flex; gap: 12px; overflow-x: auto">
  {#if viewport}
    <Track root={viewport} />
  {/if}
</div>

<!-- Track.svelte -->
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

{#each $scroll.pages.flatMap((page) => page.photos) as photo (photo.id)}
  <Card {...photo} style="flex: 0 0 180px" />
{/each}

{#if $scroll.hasNextPage}
  <div use:target style="flex: 0 0 180px">{$scroll.isFetchingNextPage ? 'Loading…' : ''}</div>
{/if}
```

```ts [Vanilla]
import { createInfiniteScroll } from '@scrollstackjs/core'

const rail = document.querySelector('#rail')!

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  root: rail, // measure against the rail, not the viewport
  rootMargin: '0px 320px 0px 0px',
})

scroll.subscribe(() => render(scroll.getSnapshot()))
scroll.observeTarget(document.querySelector('#rail-sentinel')!)
```

:::

## Vertical versus horizontal, side by side

|                   | Vertical page feed                     | Horizontal rail                        |
| ----------------- | -------------------------------------- | -------------------------------------- |
| Sentinel position | bottom of the list                     | right edge of the track                |
| `root`            | the viewport (default)                 | the scroll container                   |
| `rootMargin`      | `'0px 0px 400px 0px'` (prefetch below) | `'0px 400px 0px 0px'` (prefetch ahead) |
| Sentinel size     | needs height                           | needs **width**                        |

## Why `root` matters here

A sentinel inside an `overflow-x` box already works with the default viewport
root — ancestors clip the target's rect, so a sentinel scrolled off the end of the
rail isn't intersecting.

The reason to set it anyway is `rootMargin`. Measured against the viewport, a
right-hand margin means "before the right edge of the _window_", which is not
where your rail ends. Only when `root` **is** the rail does
`'0px 320px 0px 0px'` mean "start loading 320px before the end of the track".

::: warning A zero-width sentinel never fires
In a flex row, a `<div>` with no content collapses to zero width and can never
intersect. Give it a real size — the same trap as a zero-height sentinel in a
vertical list.
:::

> **Reference →** [Horizontal & scoped scrolling](/guide/horizontal) for the
> mounting problem in more depth.
