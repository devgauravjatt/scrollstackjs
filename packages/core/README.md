# @scrollstackjs/core

[![npm](https://img.shields.io/npm/v/@scrollstackjs/core.svg?color=1e9e6a)](https://www.npmjs.com/package/@scrollstackjs/core)
[![gzipped](https://img.shields.io/badge/gzipped-1.91%20kB-1e9e6a)](https://scrollstack.js.org/api/core)
[![license](https://img.shields.io/npm/l/@scrollstackjs/core.svg?color=1e9e6a)](https://github.com/devgauravjatt/scrollstackjs/blob/main/LICENSE)

The headless infinite-scroll engine — pagination, retry, cancellation, the state
machine and the intersection trigger. Framework-agnostic, zero runtime
dependencies, **1.91 KB gzipped**.

📖 **[Docs](https://scrollstack.js.org/)** · [API reference](https://scrollstack.js.org/api/core) · [Live demo](https://scrollstack.js.org/demo) · [Tutorial](https://scrollstack.js.org/tutorial)

```bash
npm i @scrollstackjs/core
```

Using a framework? Reach for [`@scrollstackjs/react`](https://www.npmjs.com/package/@scrollstackjs/react),
[`@scrollstackjs/vue`](https://www.npmjs.com/package/@scrollstackjs/vue) or
[`@scrollstackjs/svelte`](https://www.npmjs.com/package/@scrollstackjs/svelte)
instead — they wrap this engine in a hook, composable or store.

## Quick start

```ts
import { createInfiniteScroll } from '@scrollstackjs/core';

const scroll = createInfiniteScroll({
  initialPageParam: 0,
  fetchPage: async ({ pageParam, signal }) =>
    (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
  getNextPageParam: (last) => last.nextCursor, // null = no more pages
});

scroll.subscribe(() => render(scroll.getSnapshot()));
scroll.observeTarget(sentinelEl); // or call scroll.loadNextPage() yourself
```

## The API

**Snapshot** — `status`, `fetchStatus`, `pages`, `pageParams`, `error`,
`hasNextPage`, `failureCount`, plus the `isIdle` / `isLoading` / `isSuccess` /
`isError` / `isFetching` / `isFetchingNextPage` booleans.

**Controls** — `subscribe`, `getSnapshot`, `observeTarget`, `loadNextPage`,
`retry`, `reset`, `destroy`.

## What it handles for you

- **Any pagination shape.** Cursor, offset and page-number are all just different
  `getNextPageParam` implementations — return `null`/`undefined` to end the list.
  A `0` param is valid, so the engine tests with `== null`, never truthiness.
- **Two-axis state.** `status` describes your data, `fetchStatus` describes the
  network. Keeping them separate is what makes `isFetchingNextPage` correct.
- **Load-more failures keep your data.** A first-load failure is a real `error`; a
  later-page failure leaves `status: 'success'` and sets `error` so you can render
  a retry button without losing the list.
- **Stale responses stay inert.** Every fetch carries a generation counter and an
  `AbortController`, so a response landing after `reset()` can't resurrect dead
  state. An abort counts as a cancellation, not a failure.
- **Retry with backoff**, configurable as `boolean | number | fn`.
- **SSR-safe.** Constructs and runs with no DOM; the trigger no-ops on the server.

## Learn more

|                                                                         |                                             |
| ----------------------------------------------------------------------- | ------------------------------------------- |
| [Getting started](https://scrollstack.js.org/guide/getting-started)     | Install and first feed                      |
| [Core concepts](https://scrollstack.js.org/guide/concepts)              | The snapshot and the two-axis state machine |
| [Pagination](https://scrollstack.js.org/guide/pagination)               | Cursor, offset and page-number recipes      |
| [Errors & retry](https://scrollstack.js.org/guide/errors-and-retry)     | Backoff, manual retry, load-more failures   |
| [Server rendering](https://scrollstack.js.org/guide/ssr)                | What runs where                             |
| [Events & plugins](https://scrollstack.js.org/guide/events-and-plugins) | Lifecycle hooks and the plugin contract     |
| [Architecture decisions](https://scrollstack.js.org/decisions)          | Why the engine is built this way            |

## Contributing

Issues and pull requests are welcome — see
[CONTRIBUTING.md](https://github.com/devgauravjatt/scrollstackjs/blob/main/CONTRIBUTING.md).

MIT © [devgauravjatt](https://github.com/devgauravjatt)
