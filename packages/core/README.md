# @scrollstackjs/core

The headless infinite-scroll engine — pagination, retry, cancellation, the state
machine and the intersection observer. Framework-agnostic, zero runtime
dependencies, **1.92 KB gzipped**.

```bash
npm i @scrollstackjs/core
```

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

**Snapshot:** `status`, `fetchStatus`, `pages`, `pageParams`, `error`,
`hasNextPage`, `failureCount`, plus the `isIdle` / `isLoading` / `isSuccess` /
`isError` / `isFetching` / `isFetchingNextPage` booleans.

**Controls:** `subscribe`, `getSnapshot`, `observeTarget`, `loadNextPage`,
`retry`, `reset`, `destroy`.

Cursor, offset and page-number pagination are all just different
`getNextPageParam` implementations — return `null`/`undefined` to end the list.

Using a framework? Reach for `@scrollstackjs/react`, `@scrollstackjs/vue` or
`@scrollstackjs/svelte` instead — they wrap this engine.

MIT
