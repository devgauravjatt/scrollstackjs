# @scrollstackjs/react

React adapter for [ScrollStack](https://www.npmjs.com/package/@scrollstackjs/core) —
a headless `useInfiniteScroll` hook. You bring the markup; the engine owns the
behavior. **0.32 KB gzipped**, bound with `useSyncExternalStore` (concurrent- and
SSR-safe).

```bash
npm i @scrollstackjs/react
```

Requires React >= 18. Pulls in `@scrollstackjs/core` automatically.

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

The `ref` sentinel loads the next page when it scrolls into view. The hook
returns the full core snapshot plus `ref`, `loadNextPage`, `retry`, `reset` and
`engine`.

> v0: options are read once on mount. If the data source changes, call `reset()`
> or remount via a `key`.

MIT
