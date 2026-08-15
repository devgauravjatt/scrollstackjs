# @scrollstackjs/virtual

[![npm](https://img.shields.io/npm/v/@scrollstackjs/virtual.svg?color=1e9e6a)](https://www.npmjs.com/package/@scrollstackjs/virtual)
[![gzipped](https://img.shields.io/badge/gzipped-2.70%20kB-1e9e6a)](https://scrollstack.js.org/api/virtual)
[![license](https://img.shields.io/npm/l/@scrollstackjs/virtual.svg?color=1e9e6a)](https://github.com/devgauravjatt/scrollstackjs/blob/main/LICENSE)

Headless list virtualization for [ScrollStack](https://scrollstack.js.org/) — render
50 rows out of 50,000. Dynamic row measurement, window or container scrolling, and a
bridge that keeps loading pages once the sentinel a virtual list can't render is no
longer an option. **2.70 KB gzipped**, framework-agnostic, SSR-safe.

📖 **[Docs](https://scrollstack.js.org/guide/virtual-lists)** · [API reference](https://scrollstack.js.org/api/virtual) · [Live demo](https://scrollstack.js.org/demo)

```bash
npm i @scrollstackjs/virtual
```

Useful with or without the scroll engine — a static 50,000-row table needs no
pagination. Framework bindings ship with the adapters you already have:
`@scrollstackjs/react/virtual`, `/vue/virtual`, `/svelte/virtual`.

## Quick start (React)

```tsx
import { useVirtualizer } from '@scrollstackjs/react/virtual';

function Rows({ rows }: { rows: Row[] }) {
  const { items, totalSize, scrollRef, measureRef } = useVirtualizer({
    count: rows.length,
    estimateSize: () => 48, // a ballpark; measured rows replace it
  });

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
  );
}
```

Three pieces do all the work: a spacer sized to `totalSize` so the scrollbar is
honest, `item.start` to place each row, and `data-index` + `measureRef` so rows of
unequal height correct their own estimates.

## Headless (any framework)

```ts
import { createVirtualizer } from '@scrollstackjs/virtual';

const virtualizer = createVirtualizer({ count: rows.length, estimateSize: () => 48 });
virtualizer.setScrollElement(document.querySelector('#scroller')); // or `window`

virtualizer.subscribe(() => {
  const { items, totalSize } = virtualizer.getSnapshot();
  render(items, totalSize);
});
```

The snapshot changes only when the _rendered window_ changes, so scrolling within
the current window costs a binary search rather than a render.

## With infinite scrolling

A virtual list can't rely on a sentinel — the element after the last row usually
isn't in the DOM. `connectInfiniteScroll` watches the rendered window instead and
asks the engine for another page as it nears the end:

```ts
import { createInfiniteScroll } from '@scrollstackjs/core';
import { connectInfiniteScroll, createVirtualizer } from '@scrollstackjs/virtual';

const engine = createInfiniteScroll({ initialPageParam: 0, fetchPage, getNextPageParam });
const virtualizer = createVirtualizer({ count: 0, estimateSize: () => 64 });

const disconnect = connectInfiniteScroll(virtualizer, engine, { threshold: 5 });
engine.subscribe(() => virtualizer.setOptions({ count: items().length }));
```

It loads the first page too, leaves a failed load to the engine's retry policy, and
requests one page per count so a slow API can't stack up duplicate requests.

## License

MIT
