# Virtual lists

Infinite scrolling has a ceiling. Every page you load stays in the DOM, and somewhere
around a few thousand rows the browser starts paying for all of them on every layout
— scrolling stutters, memory climbs, and the feed that felt instant at page 3 feels
broken at page 30.

Virtualization removes the ceiling by rendering only what is on screen. 50 rows out
of 50,000, and a spacer element holding the scrollbar honest.

```bash
npm i @scrollstackjs/virtual
```

`@scrollstackjs/virtual` is a separate package and works on its own — a
static 50,000-row table has nothing to paginate. The framework bindings live in the
adapters you already have, behind a `/virtual` entry point, so nothing is added to
your bundle unless you import it.

## The shape of a virtual list

Three things, in every framework:

1. **A scroll container** — the element with `overflow: auto`, or the page itself.
2. **A spacer** sized to `totalSize`, so the scrollbar matches the full list.
3. **Rows positioned at `item.start`**, absolutely, inside that spacer.

::: code-group

```tsx [React]
import { useVirtualizer } from '@scrollstackjs/react/virtual'

function Rows({ rows }: { rows: Row[] }) {
  const { items, totalSize, scrollRef, measureRef } = useVirtualizer({
    count: rows.length,
    estimateSize: () => 48,
  })

  return (
    <div ref={scrollRef} style={{ overflow: 'auto', height: 400 }}>
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

const props = defineProps<{ rows: Row[] }>()

// `count` takes a getter, so the window follows the list as it grows.
const { state, scrollTarget, measure } = useVirtualizer({
  count: () => props.rows.length,
  estimateSize: () => 48,
})
</script>

<template>
  <div :ref="scrollTarget" style="overflow: auto; height: 400px">
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

  export let rows: Row[]

  const virtual = createVirtualizer({ count: rows.length, estimateSize: () => 48 })
  $: virtual.setCount(rows.length)
  onDestroy(virtual.destroy)
</script>

<div use:virtual.scroller style="overflow: auto; height: 400px">
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

const virtualizer = createVirtualizer({ count: rows.length, estimateSize: () => 48 })
virtualizer.setScrollElement(scroller)

virtualizer.subscribe(() => {
  const { items, totalSize } = virtualizer.getSnapshot()
  spacer.style.height = `${totalSize}px`
  // …render `items`, each positioned at `item.start`
})
```

:::

## Estimates and measurement

`estimateSize` only has to be in the right ballpark. It decides the scrollbar's
initial length and which rows come first; a rendered row then replaces its own
estimate with a real measurement, and everything below it re-stacks.

That is what `data-index` and the measure ref are for. Skip them and the list still
works — as long as every row really is `estimateSize` tall. Add them and rows of any
height are handled, including ones that change size later (an image loading, a
"show more" toggle): a `ResizeObserver` watches every rendered row.

When a row **above** the viewport turns out to be a different size than estimated,
the virtualizer compensates the scroll offset by the same amount, so what you are
looking at doesn't jump. Turn it off with `adjustScrollOnMeasure: false`.

::: tip Rows that aren't laid out yet
An element inside a `display: none` subtree reports zero width _and_ zero height.
The virtualizer treats that as "not measurable yet" and keeps the estimate rather
than collapsing the row — a collapsed row would move the window onto rows that are
also hidden, and the list would never settle.
:::

## Scrolling the page instead of a box

Pass the container you actually scroll. For a page-level list that is `window`:

::: code-group

```tsx [React]
const { items, totalSize, measureRef } = useVirtualizer({
  count: rows.length,
  estimateSize: () => 48,
  scrollElement: typeof window === 'undefined' ? null : window,
  scrollMargin: listTop, // distance from the top of the page to the list
})
```

```ts [Vanilla]
virtualizer.setScrollElement(window)
virtualizer.setOptions({ scrollMargin: list.offsetTop })
```

:::

`scrollMargin` is the piece people miss: the virtualizer lays rows out from 0, but
the page's scroll offset includes everything above the list. Without it, the window
is wrong by exactly the height of your header.

## With infinite scrolling

The sentinel doesn't survive virtualization: the element after the last row usually
isn't rendered, and when it is, it sits at the bottom of a spacer the user may never
reach. So the trigger moves from geometry to indices — once the rendered window comes
within `threshold` items of the end, load another page.

Both stores are bound the way you already bind one, and the only thing tying them
together is `count` — the flattened item length:

::: code-group

```tsx [React]
import { useInfiniteScroll } from '@scrollstackjs/react'
import { useVirtualizer } from '@scrollstackjs/react/virtual'
import { connectInfiniteScroll } from '@scrollstackjs/virtual'
import { useEffect, useMemo } from 'react'

function Feed() {
  const { pages, engine } = useInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
  })

  const rows = useMemo(() => pages.flatMap((page) => page.items), [pages])

  const { items, totalSize, scrollRef, measureRef, virtualizer } = useVirtualizer({
    count: rows.length,
    estimateSize: () => 64,
  })

  // One effect, and the list feeds itself from then on.
  useEffect(
    () => connectInfiniteScroll(virtualizer, engine, { threshold: 5 }),
    [virtualizer, engine],
  )

  // …render as above, reading rows[item.index]
}
```

```vue [Vue]
<script setup lang="ts">
import { useInfiniteScroll } from '@scrollstackjs/vue'
import { useVirtualizer } from '@scrollstackjs/vue/virtual'
import { connectInfiniteScroll } from '@scrollstackjs/virtual'
import { computed, onScopeDispose } from 'vue'

const { state: feed, engine } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
})

const rows = computed(() => feed.value.pages.flatMap((page) => page.items))

const { state, scrollTarget, measure, virtualizer } = useVirtualizer({
  count: () => rows.value.length,
  estimateSize: () => 64,
})

onScopeDispose(connectInfiniteScroll(virtualizer, engine, { threshold: 5 }))
</script>
```

```svelte [Svelte]
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  import { createVirtualizer } from '@scrollstackjs/svelte/virtual'
  import { connectInfiniteScroll } from '@scrollstackjs/virtual'

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage,
    getNextPageParam: (last) => last.nextCursor,
  })

  const virtual = createVirtualizer({ count: 0, estimateSize: () => 64 })

  $: rows = $scroll.pages.flatMap((page) => page.items)
  $: virtual.setCount(rows.length)

  const disconnect = connectInfiniteScroll(virtual.virtualizer, scroll.engine, { threshold: 5 })

  onDestroy(() => {
    disconnect()
    virtual.destroy()
    scroll.destroy()
  })
</script>
```

:::

A runnable version of this, against a real API, is on the
[Virtual list example](/examples/virtual) page.

`connectInfiniteScroll` loads the first page as well — with no sentinel, nothing else
would. Two guards keep it honest: a pending `error` is left to the engine's retry
policy instead of being re-triggered on every scroll frame, and only one page is
requested per `count`, so a slow API can't stack up duplicate requests for the same
data.

## Server rendering

The virtualizer constructs and renders with no DOM. Before a scroll container is
attached it uses `initialViewport` and `initialOffset`, so the server can render a
usable first screen instead of the overscan alone:

```ts
createVirtualizer({
  count: rows.length,
  estimateSize: () => 48,
  initialViewport: 800, // roughly a screen
})
```

The client attaches the real container on mount, measures it, and takes over from
there. See [Server rendering](/guide/ssr) for the rest of the SSR story.

## Performance notes

- **A snapshot changes only when the rendered window changes.** Scrolling inside the
  current window costs a binary search, not a render. Read the live offset with
  `virtualizer.getScrollOffset()` if you need it — it is deliberately not in the
  snapshot.
- **`overscan` trades memory for blank frames.** The default of 3 is a good starting
  point; raise it if fast flings show gaps, lower it for very expensive rows.
- **Measuring the suffix, not the list.** A row that reports a new size re-stacks
  only the rows after it, so measurement stays cheap however long the list is.
- **`isScrolling`** is on the snapshot for skipping expensive work mid-fling (images,
  tooltips). Set `isScrollingDelay: 0` to opt out of the two renders per scroll burst.

## What is not here

`scrollToIndex` supports `'auto' | 'start' | 'center' | 'end'` alignment and smooth
behavior, but a few things are deliberately out of scope for this release: grids and
multi-column lanes, sticky headers, and reverse (bottom-anchored) lists. The layout
primitives are exported (`measure`, `computeRange`, `offsetForIndex`) if you want to
build on them — see [`@scrollstackjs/virtual`](/api/virtual).
