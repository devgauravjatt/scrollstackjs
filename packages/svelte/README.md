# @scrollstackjs/svelte

Svelte adapter for [ScrollStack](https://www.npmjs.com/package/@scrollstackjs/core) —
a headless store + action. You bring the markup; the engine owns the behavior. No
Svelte runtime is imported, so it stays tiny and works in Svelte 4 and 5 alike.

```bash
npm i @scrollstackjs/svelte
```

Requires Svelte >= 4. Pulls in `@scrollstackjs/core` automatically.

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createInfiniteScroll } from '@scrollstackjs/svelte';

  const scroll = createInfiniteScroll({
    initialPageParam: 0,
    fetchPage: async ({ pageParam, signal }) =>
      (await fetch(`/api/items?cursor=${pageParam}`, { signal })).json(),
    getNextPageParam: (last) => last.nextCursor, // null = no more pages
  });
  const { target } = scroll;
  onDestroy(scroll.destroy);
</script>

<ul>
  {#each $scroll.pages.flatMap((p) => p.items) as item (item.id)}<li>{item.name}</li>{/each}
  {#if $scroll.hasNextPage}<li use:target>{$scroll.isFetchingNextPage ? 'Loading…' : ''}</li>{/if}
</ul>
```

`$scroll` is the core snapshot. The `use:target` sentinel loads the next page when
it scrolls into view. The store also carries `loadNextPage`, `retry`, `reset`,
`destroy` and `engine`.

MIT
