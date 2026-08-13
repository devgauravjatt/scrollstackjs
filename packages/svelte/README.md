# @scrollstackjs/svelte

[![npm](https://img.shields.io/npm/v/@scrollstackjs/svelte.svg?color=1e9e6a)](https://www.npmjs.com/package/@scrollstackjs/svelte)
[![gzipped](https://img.shields.io/badge/gzipped-0.25%20kB-1e9e6a)](https://scrollstack.js.org/api/svelte)
[![license](https://img.shields.io/npm/l/@scrollstackjs/svelte.svg?color=1e9e6a)](https://github.com/devgauravjatt/scrollstackjs/blob/main/LICENSE)

Svelte adapter for [ScrollStack](https://scrollstack.js.org/) — a headless store
plus a sentinel action. You bring the markup; the engine owns the behavior.
**0.25 KB gzipped**, and no Svelte runtime is imported, so it works in Svelte 4 and
5 alike.

📖 **[Docs](https://scrollstack.js.org/)** · [API reference](https://scrollstack.js.org/api/svelte) · [Live demo](https://scrollstack.js.org/demo) · [Tutorial](https://scrollstack.js.org/tutorial)

```bash
npm i @scrollstackjs/svelte
```

Requires Svelte >= 4. Pulls in `@scrollstackjs/core` automatically.

## Quick start

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

The returned value _is_ a Svelte store, so `$scroll` is the core snapshot. The
`use:target` sentinel loads the next page when it scrolls into view. The store also
carries `loadNextPage`, `retry`, `reset`, `destroy` and `engine`.

## Handling errors

A failed _load-more_ keeps the pages you already have — `status` stays `'success'`
while `error` is set, so you can offer a retry without blanking the list:

```svelte
{#if $scroll.error && $scroll.pages.length && !$scroll.isFetching}
  <button on:click={scroll.retry}>Retry</button>
{/if}
```

## Learn more

|                                                                     |                                             |
| ------------------------------------------------------------------- | ------------------------------------------- |
| [Getting started](https://scrollstack.js.org/guide/getting-started) | Install and first feed                      |
| [Core concepts](https://scrollstack.js.org/guide/concepts)          | The snapshot and the two-axis state machine |
| [Pagination](https://scrollstack.js.org/guide/pagination)           | Cursor, offset and page-number recipes      |
| [Errors & retry](https://scrollstack.js.org/guide/errors-and-retry) | Backoff, manual retry, load-more failures   |
| [Server rendering](https://scrollstack.js.org/guide/ssr)            | SvelteKit and what runs where               |
| [Devtools](https://scrollstack.js.org/api/devtools)                 | Inspect the engine while you build          |

## Contributing

Issues and pull requests are welcome — see
[CONTRIBUTING.md](https://github.com/devgauravjatt/scrollstackjs/blob/main/CONTRIBUTING.md).

MIT © [devgauravjatt](https://github.com/devgauravjatt)
