# @scrollstackjs/virtual

Headless list virtualization: it decides which slice of a long list is worth
rendering and where each row sits, and owns nothing else. No markup, no styles, no
framework. **2.70 KB gzipped**, SSR-safe, usable with or without the scroll engine.

```bash
npm i @scrollstackjs/virtual
```

```ts
import { createVirtualizer } from '@scrollstackjs/virtual'
```

Framework bindings ship with the adapters, behind a `/virtual` entry point:
[`@scrollstackjs/react/virtual`](#usevirtualizer-react),
[`/vue/virtual`](#usevirtualizer-vue), [`/svelte/virtual`](#createvirtualizer-svelte).
The guide is at [Virtual lists](/guide/virtual-lists).

## createVirtualizer

```ts
function createVirtualizer(options: VirtualizerOptions): Virtualizer
```

Returns a store in the same shape as the scroll engine — `subscribe` +
`getSnapshot`, with referentially stable snapshots — so it binds with the same
primitives.

```ts
const virtualizer = createVirtualizer({ count: rows.length, estimateSize: () => 48 })
virtualizer.setScrollElement(document.querySelector('#scroller'))

virtualizer.subscribe(() => {
  const { items, totalSize } = virtualizer.getSnapshot()
  spacer.style.height = `${totalSize}px`
  render(items) // position each row at `item.start`
})
```

Throws a `ScrollStackError` when `estimateSize` or `count` is missing.

### VirtualizerOptions

| Option                  | Type                         | Default | Description                                                                                           |
| ----------------------- | ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `count`                 | `number`                     | —       | Total items. Push a new one in with `setOptions` as pages land.                                       |
| `estimateSize`          | `(index: number) => number`  | —       | Estimated row size along the scroll axis, in pixels. Measured rows replace it.                        |
| `overscan`              | `number`                     | `3`     | Extra rows rendered each side of the visible window.                                                  |
| `horizontal`            | `boolean`                    | `false` | Lay out along the x-axis.                                                                             |
| `paddingStart`          | `number`                     | `0`     | Space before the first row.                                                                           |
| `paddingEnd`            | `number`                     | `0`     | Space after the last row.                                                                             |
| `gap`                   | `number`                     | `0`     | Space between adjacent rows.                                                                          |
| `getItemKey`            | `(index: number) => ItemKey` | index   | Row identity. A stable key keeps a measured size with its row when the list is re-ordered.            |
| `scrollMargin`          | `number`                     | `0`     | Distance from the top of the scroll container to the top of the list. Needed for page-scrolled lists. |
| `initialOffset`         | `number`                     | `0`     | Scroll offset assumed before a container is attached (SSR, first paint).                              |
| `initialViewport`       | `number`                     | `0`     | Viewport size assumed before a container is attached. Decides how much the server renders.            |
| `isScrollingDelay`      | `number`                     | `150`   | How long `isScrolling` stays `true` after the last scroll event. `0` disables it.                     |
| `adjustScrollOnMeasure` | `boolean`                    | `true`  | Compensate the scroll offset when a row **above** the viewport is measured a different size.          |

### VirtualizerSnapshot

The value `getSnapshot()` returns. Same object reference until the _rendered output_
changes — scrolling within the current window produces no new snapshot, and so no
re-render.

| Field         | Type                     | Description                                                                    |
| ------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `items`       | `readonly VirtualItem[]` | The rows to render, in order.                                                  |
| `totalSize`   | `number`                 | Size of the whole list including padding — your spacer's height.               |
| `startIndex`  | `number`                 | Index of the first rendered row (visible window minus overscan).               |
| `endIndex`    | `number`                 | Index of the last rendered row, inclusive. `-1` when the list is empty.        |
| `count`       | `number`                 | Total rows the virtualizer knows about.                                        |
| `isScrolling` | `boolean`                | `true` from the first scroll event until `isScrollingDelay` ms after the last. |

### VirtualItem

| Field   | Type               | Description                                                          |
| ------- | ------------------ | -------------------------------------------------------------------- |
| `index` | `number`           | Position in the full list — use it to look the row's data up.        |
| `key`   | `string \| number` | Stable identity. Use it as the framework key.                        |
| `start` | `number`           | Offset from the start of the list, in pixels. Position rows with it. |
| `end`   | `number`           | `start + size`.                                                      |
| `size`  | `number`           | Measured size when known, the estimate otherwise.                    |

### Virtualizer

| Member              | Type                                                 | Description                                                           |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `getSnapshot`       | `() => VirtualizerSnapshot`                          | Current snapshot (stable reference).                                  |
| `subscribe`         | `(listener: () => void) => () => void`               | Subscribe to changes; returns unsubscribe.                            |
| `setOptions`        | `(options: Partial<VirtualizerOptions>) => void`     | Merge new options. `undefined` leaves a field alone.                  |
| `setScrollElement`  | `(target: Element \| Window \| null) => void`        | Attach the scroller. `null` detaches. Same target twice is a no-op.   |
| `measureElement`    | `(element: Element \| null, index?: number) => void` | Record a row's real size and watch it for changes. `null` is ignored. |
| `resetMeasurements` | `() => void`                                         | Drop every measured size back to its estimate.                        |
| `scrollToIndex`     | `(index: number, options?: ScrollToOptions) => void` | Scroll a row into view. Out-of-range indices are clamped.             |
| `scrollToOffset`    | `(offset: number, options?: { behavior }) => void`   | Scroll to an absolute offset, clamped at 0.                           |
| `getOffsetForIndex` | `(index: number, align?: ScrollAlignment) => number` | The offset `scrollToIndex` would use, without scrolling.              |
| `getScrollOffset`   | `() => number`                                       | The live scroll offset. Reading it never causes a render.             |
| `getViewportSize`   | `() => number`                                       | Measured viewport size along the scroll axis.                         |
| `destroy`           | `() => void`                                         | Detach listeners and observers. The DOM is untouched.                 |

`ScrollToOptions` is `{ align?: 'auto' | 'start' | 'center' | 'end', behavior?: 'auto' | 'smooth' }`.
`'auto'` alignment scrolls the shortest distance that reveals the row, and does
nothing when it is already fully visible.

### Measuring rows

`measureElement` takes the row's index from its `data-index` attribute, so one stable
ref works for every row:

```tsx
<div data-index={item.index} ref={measureRef} />
```

Pass the index explicitly (`measureElement(node, item.index)`) if you would rather
not render the attribute. A `ResizeObserver` keeps watching each rendered row, so
rows that change size later — an image loading, a "show more" toggle — correct
themselves; rows are unwatched as they leave the window, and their measured sizes are
kept.

An element with no layout box at all (zero width _and_ zero height — a `display: none`
subtree, or a row measured before first paint) is skipped rather than recorded as
0px. See [Virtual lists](/guide/virtual-lists#estimates-and-measurement).

## connectInfiniteScroll

```ts
function connectInfiniteScroll<TData, TPageParam>(
  virtualizer: Virtualizer,
  engine: InfiniteScroll<TData, TPageParam>,
  options?: { threshold?: number },
): () => void
```

Loads pages as the rendered window approaches the end of the list, replacing the
sentinel a virtual list cannot render. Returns a disconnect function.

```ts
const disconnect = connectInfiniteScroll(virtualizer, engine, { threshold: 5 })
```

| Option      | Type     | Default | Description                                                      |
| ----------- | -------- | ------- | ---------------------------------------------------------------- |
| `threshold` | `number` | `5`     | How close to the end of the list the window must come, in items. |

It also loads the **first** page, since nothing else will. Two guards prevent a fetch
loop: a pending `error` is left to the engine's retry policy (call `engine.retry()`
to resume), and one page is requested per `count`, so a batch that arrives before the
binding has pushed the new count in doesn't stack up requests.

## useVirtualizer (React)

```ts
import { useVirtualizer } from '@scrollstackjs/react/virtual'

function useVirtualizer(options: UseVirtualizerOptions): UseVirtualizerResult
```

`VirtualizerOptions` plus an optional `scrollElement`, bound with
`useSyncExternalStore`. Unlike `useInfiniteScroll`, options are read on **every**
render — `count` grows as pages land, and a stale count renders the wrong window.

Returns everything on the snapshot, plus:

| Member           | Type                              | Description                                          |
| ---------------- | --------------------------------- | ---------------------------------------------------- |
| `scrollRef`      | `(node: Element \| null) => void` | Attach to the scrolling element.                     |
| `measureRef`     | `(node: Element \| null) => void` | Attach to every row, with `data-index={item.index}`. |
| `scrollToIndex`  | `(index, options?) => void`       | Scroll a row into view.                              |
| `scrollToOffset` | `(offset, options?) => void`      | Scroll to an absolute offset.                        |
| `virtualizer`    | `Virtualizer`                     | Escape hatch: the underlying virtualizer.            |

Pass `scrollElement` **or** attach `scrollRef`, not both. For a page-scrolled list,
`scrollElement: typeof window === 'undefined' ? null : window`.

## useVirtualizer (Vue)

```ts
import { useVirtualizer } from '@scrollstackjs/vue/virtual'
```

`count` accepts a ref or a getter as well as a plain number — it is the option that
changes while the list is on screen. Everything else is read once, at setup.

| Member             | Type                              | Description                                                           |
| ------------------ | --------------------------------- | --------------------------------------------------------------------- |
| `state`            | `ShallowRef<VirtualizerSnapshot>` | The live snapshot. Auto-unwraps in templates.                         |
| `scrollTarget`     | `(el) => void`                    | Function ref for the scrolling element: `:ref="scrollTarget"`.        |
| `measure`          | `(el) => void`                    | Function ref for each row: `:ref="measure" :data-index="item.index"`. |
| `setScrollElement` | `(target) => void`                | Attach a scroller you already hold — `window`, typically.             |
| `scrollToIndex`    | `(index, options?) => void`       | Scroll a row into view.                                               |
| `scrollToOffset`   | `(offset, options?) => void`      | Scroll to an absolute offset.                                         |
| `virtualizer`      | `Virtualizer`                     | The underlying virtualizer.                                           |

Both refs accept a component instance as well as an element, so rows may be
components. Teardown is wired to the effect scope.

## createVirtualizer (Svelte)

```ts
import { createVirtualizer } from '@scrollstackjs/svelte/virtual'
```

Returns a value that _is_ a store — `$virtual` gives you the snapshot — with the
actions and controls attached.

| Member             | Type                         | Description                                                         |
| ------------------ | ---------------------------- | ------------------------------------------------------------------- |
| `scroller`         | `(node) => { destroy() }`    | Action for the scrolling element: `use:virtual.scroller`.           |
| `measure`          | `(node) => { destroy() }`    | Action for each row: `use:virtual.measure data-index={item.index}`. |
| `setCount`         | `(count: number) => void`    | Push a new count in: `$: virtual.setCount(rows.length)`.            |
| `setScrollElement` | `(target) => void`           | Attach a scroller you already hold.                                 |
| `scrollToIndex`    | `(index, options?) => void`  | Scroll a row into view.                                             |
| `scrollToOffset`   | `(offset, options?) => void` | Scroll to an absolute offset.                                       |
| `destroy`          | `() => void`                 | Full teardown — `onDestroy(virtual.destroy)`.                       |
| `virtualizer`      | `Virtualizer`                | The underlying virtualizer.                                         |

## Layout primitives

The pure geometry functions are exported for anyone building a different virtualizer
on the same contracts — they hold no state and touch no DOM.

| Function                                                                     | Description                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `measure(previous, from, spec)`                                              | Lays out items `[from, count)`, reusing the prefix by reference. |
| `totalSize(measurements, spec)`                                              | Size of the whole list including padding.                        |
| `findFirstVisible(measurements, offset)`                                     | Binary search for the first row past `offset`.                   |
| `computeRange(measurements, offset, viewport, overscan)`                     | The window to render.                                            |
| `offsetForIndex(measurements, index, align, offset, viewport, scrollMargin)` | The offset that aligns a row.                                    |
