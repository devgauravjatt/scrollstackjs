# @scrollstackjs/react

[![npm](https://img.shields.io/npm/v/@scrollstackjs/react.svg?color=1e9e6a)](https://www.npmjs.com/package/@scrollstackjs/react)
[![gzipped](https://img.shields.io/badge/gzipped-0.32%20kB-1e9e6a)](https://scrollstack.js.org/api/react)
[![license](https://img.shields.io/npm/l/@scrollstackjs/react.svg?color=1e9e6a)](https://github.com/devgauravjatt/scrollstackjs/blob/main/LICENSE)

React adapter for [ScrollStack](https://scrollstack.js.org/) — a headless
`useInfiniteScroll` hook. You bring the markup; the engine owns the behavior.
**0.32 KB gzipped**, bound with `useSyncExternalStore` (concurrent- and SSR-safe).

📖 **[Docs](https://scrollstack.js.org/)** · [API reference](https://scrollstack.js.org/api/react) · [Live demo](https://scrollstack.js.org/demo) · [Tutorial](https://scrollstack.js.org/tutorial)

```bash
npm i @scrollstackjs/react
```

Requires React >= 18. Pulls in `@scrollstackjs/core` automatically.

## Quick start

```tsx
import { useInfiniteScroll } from '@scrollstackjs/react';

function Feed() {
  const { pages, ref, hasNextPage, isFetchingNextPage } = useInfiniteScroll({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) =>
      (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
    getNextPageParam: (last) => last.nextCursor, // null = no more pages
  });

  return (
    <>
      {pages
        .flatMap((p) => p.items)
        .map((item) => (
          <Row key={item.id} {...item} />
        ))}
      {hasNextPage && <div ref={ref}>{isFetchingNextPage ? 'Loading…' : ''}</div>}
    </>
  );
}
```

The `ref` sentinel loads the next page when it scrolls into view. The hook returns
the full core snapshot plus `ref`, `loadNextPage`, `retry`, `reset` and `engine`.

## Handling errors

A failed _load-more_ keeps the pages you already have — `status` stays `'success'`
while `error` is set, so you can offer a retry without blanking the list:

```tsx
function Feed() {
  const { pages, error, isFetching, retry } = useInfiniteScroll(options);

  return (
    <>
      {/* …rows… */}
      {error && pages.length > 0 && !isFetching && <button onClick={retry}>Retry</button>}
    </>
  );
}
```

> **v0 note:** options are read once on mount. If the data source changes, call
> `reset()` or remount via a `key`. Reactive options are on the roadmap.

## Learn more

|                                                                     |                                             |
| ------------------------------------------------------------------- | ------------------------------------------- |
| [Getting started](https://scrollstack.js.org/guide/getting-started) | Install and first feed                      |
| [Core concepts](https://scrollstack.js.org/guide/concepts)          | The snapshot and the two-axis state machine |
| [Pagination](https://scrollstack.js.org/guide/pagination)           | Cursor, offset and page-number recipes      |
| [Errors & retry](https://scrollstack.js.org/guide/errors-and-retry) | Backoff, manual retry, load-more failures   |
| [Server rendering](https://scrollstack.js.org/guide/ssr)            | What runs where                             |
| [Devtools](https://scrollstack.js.org/api/devtools)                 | Inspect the engine while you build          |

## Contributing

Issues and pull requests are welcome — see
[CONTRIBUTING.md](https://github.com/devgauravjatt/scrollstackjs/blob/main/CONTRIBUTING.md).

MIT © [devgauravjatt](https://github.com/devgauravjatt)
