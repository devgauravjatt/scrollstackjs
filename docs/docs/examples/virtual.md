# Virtual list

Infinite scrolling has a ceiling: every page you load stays in the DOM, and past a
few thousand rows the browser pays for all of them on every layout.
[`@scrollstackjs/virtual`](/api/virtual) removes it by rendering only what is on
screen.

```bash
npm i @scrollstackjs/virtual
```

Ten thousand rows below. Count the ones actually in the DOM.

<VirtualDemo />

## The three moving parts

1. **A scroll container** — the element with `overflow: auto`, or the page itself.
2. **A spacer** sized to `totalSize`, so the scrollbar matches the full list.
3. **Rows positioned at `item.start`**, absolutely, inside that spacer.

::: code-group

```tsx [React]
import { useVirtualizer } from '@scrollstackjs/react/virtual'

interface Row {
  id: number
  label: string
}

export function Rows({ rows }: { rows: Row[] }) {
  const { items, totalSize, scrollRef, measureRef } = useVirtualizer({
    count: rows.length,
    estimateSize: () => 44, // a ballpark; measured rows replace it
    overscan: 4,
  })

  return (
    <div ref={scrollRef} style={{ overflow: 'auto', height: 340 }}>
      <div style={{ height: totalSize, position: 'relative' }}>
        {items.map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={measureRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${item.start}px)`,
            }}
          >
            {rows[item.index].label}
          </div>
        ))}
      </div>
    </div>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { useVirtualizer } from '@scrollstackjs/vue/virtual'

const props = defineProps<{ rows: { id: number; label: string }[] }>()

// `count` takes a getter, so the window follows the list as it grows.
const { state, scrollTarget, measure } = useVirtualizer({
  count: () => props.rows.length,
  estimateSize: () => 44,
  overscan: 4,
})
</script>

<template>
  <div :ref="scrollTarget" style="overflow: auto; height: 340px">
    <div :style="{ height: `${state.totalSize}px`, position: 'relative' }">
      <div
        v-for="item in state.items"
        :key="item.key"
        :ref="measure"
        :data-index="item.index"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${item.start}px)`,
        }"
      >
        {{ rows[item.index].label }}
      </div>
    </div>
  </div>
</template>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createVirtualizer } from '@scrollstackjs/svelte/virtual'

  export let rows: { id: number; label: string }[]

  const virtual = createVirtualizer({ count: rows.length, estimateSize: () => 44, overscan: 4 })
  $: virtual.setCount(rows.length)
  onDestroy(virtual.destroy)
</script>

<div use:virtual.scroller style="overflow: auto; height: 340px">
  <div style="height: {$virtual.totalSize}px; position: relative">
    {#each $virtual.items as item (item.key)}
      <div
        use:virtual.measure
        data-index={item.index}
        style="position: absolute; top: 0; left: 0; right: 0; transform: translateY({item.start}px)"
      >
        {rows[item.index].label}
      </div>
    {/each}
  </div>
</div>
```

```ts [Vanilla]
import { createVirtualizer } from '@scrollstackjs/virtual'

const virtualizer = createVirtualizer({
  count: rows.length,
  estimateSize: () => 44,
  overscan: 4,
})

virtualizer.setScrollElement(document.querySelector('#scroller')!) // or `window`

virtualizer.subscribe(() => {
  const { items, totalSize } = virtualizer.getSnapshot()
  spacer.style.height = `${totalSize}px`

  spacer.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement('div')
      row.dataset.index = String(item.index)
      row.style.cssText = `position:absolute;top:0;left:0;right:0;transform:translateY(${item.start}px)`
      row.textContent = rows[item.index].label
      virtualizer.measureElement(row)
      return row
    }),
  )
})
```

:::

## With infinite scrolling

A virtual list cannot render the sentinel — the element after the last row isn't
in the DOM, and when it is, it sits at the bottom of a spacer nobody scrolls to.
So the trigger moves from geometry to indices: once the rendered window comes
within `threshold` items of the end, load another page.

The demo below loads the PokéAPI ten rows at a time and virtualizes the result.
Scroll to the bottom and keep going — pages arrive, the DOM count doesn't move.

<VirtualFeedDemo />

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'
import { useVirtualizer } from '@scrollstackjs/react/virtual'
import { connectInfiniteScroll } from '@scrollstackjs/virtual'
import { useEffect, useMemo } from 'react'

const LIMIT = 10

export function Feed() {
  const { pages, engine, isLoading } = useInfiniteScroll<Pokemon[], number>({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) => {
      const response = await fetch(
        `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=${LIMIT}`,
        { signal },
      )
      if (!response.ok) throw new Error(`${response.status}`)
      return (await response.json()).results
    },
    getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length * LIMIT),
  })

  // The only thing the two stores share: how many rows there are.
  const rows = useMemo(() => pages.flat(), [pages])

  const { items, totalSize, scrollRef, measureRef, virtualizer } = useVirtualizer({
    count: rows.length,
    estimateSize: () => 56,
    overscan: 5,
  })

  // Loads the first page too — with no sentinel, nothing else would start it.
  useEffect(
    () => connectInfiniteScroll(virtualizer, engine, { threshold: 4 }),
    [virtualizer, engine],
  )

  if (isLoading) return <p>Loading…</p>

  return (
    <div ref={scrollRef} style={{ overflow: 'auto', height: 340 }}>
      <div style={{ height: totalSize, position: 'relative' }}>
        {items.map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={measureRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${item.start}px)`,
            }}
          >
            {rows[item.index].name}
          </div>
        ))}
      </div>
    </div>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { useVirtualizer } from '@scrollstackjs/vue/virtual'
import { connectInfiniteScroll } from '@scrollstackjs/virtual'
import { computed, onScopeDispose } from 'vue'

const LIMIT = 10

const { state: feed, engine } = useInfiniteScroll<Pokemon[], number>({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) => {
    const response = await fetch(
      `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=${LIMIT}`,
      { signal },
    )
    if (!response.ok) throw new Error(`${response.status}`)
    return (await response.json()).results
  },
  getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length * LIMIT),
})

const rows = computed(() => feed.value.pages.flat())

const { state, scrollTarget, measure, virtualizer } = useVirtualizer({
  count: () => rows.value.length,
  estimateSize: () => 56,
  overscan: 5,
})

onScopeDispose(connectInfiniteScroll(virtualizer, engine, { threshold: 4 }))
</script>

<template>
  <div :ref="scrollTarget" style="overflow: auto; height: 340px">
    <div :style="{ height: `${state.totalSize}px`, position: 'relative' }">
      <div
        v-for="item in state.items"
        :key="item.key"
        :ref="measure"
        :data-index="item.index"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${item.start}px)`,
        }"
      >
        {{ rows[item.index].name }}
      </div>
    </div>
  </div>
</template>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  import { createVirtualizer } from '@scrollstackjs/svelte/virtual'
  import { connectInfiniteScroll } from '@scrollstackjs/virtual'

  const LIMIT = 10

  const scroll = createInfiniteScroll<Pokemon[], number>({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) => {
      const response = await fetch(
        `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=${LIMIT}`,
        { signal },
      )
      if (!response.ok) throw new Error(`${response.status}`)
      return (await response.json()).results
    },
    getNextPageParam: (last, all) => (last.length < LIMIT ? null : all.length * LIMIT),
  })

  const virtual = createVirtualizer({ count: 0, estimateSize: () => 56, overscan: 5 })

  $: rows = $scroll.pages.flat()
  $: virtual.setCount(rows.length)

  const disconnect = connectInfiniteScroll(virtual.virtualizer, scroll.engine, { threshold: 4 })

  onDestroy(() => {
    disconnect()
    virtual.destroy()
    scroll.destroy()
  })
</script>

<div use:virtual.scroller style="overflow: auto; height: 340px">
  <div style="height: {$virtual.totalSize}px; position: relative">
    {#each $virtual.items as item (item.key)}
      <div
        use:virtual.measure
        data-index={item.index}
        style="position: absolute; top: 0; left: 0; right: 0; transform: translateY({item.start}px)"
      >
        {rows[item.index].name}
      </div>
    {/each}
  </div>
</div>
```

:::

## Things that bite

**Rows need `data-index`.** `measureElement` reads the row's index off the
attribute. Without it — and without an explicit index argument — it throws rather
than silently mismeasuring.

**`scrollMargin` for page-scrolled lists.** The virtualizer lays rows out from 0,
but the page's scroll offset includes your header. Pass the distance from the top
of the container to the top of the list, or the window is wrong by exactly that
much.

**`estimateSize` only has to be close.** It decides the initial scrollbar length
and which rows come first; a rendered row replaces its own estimate, and when a
row _above_ the viewport turns out different, the scroll offset is compensated so
nothing jumps.

**A snapshot changes only when the window changes.** Scrolling inside the current
window costs a binary search, not a render. Read `virtualizer.getScrollOffset()`
if you need the live offset — it is deliberately not on the snapshot.

> **Reference →** [Virtual lists guide](/guide/virtual-lists) for window scrolling
> and SSR, [`@scrollstackjs/virtual`](/api/virtual) for every option, and
> [ADR-009](/decisions) for why it is a second store rather than an engine mode.
