# Examples

Every example on these pages is the same thing twice: a **running demo** you can
scroll, and the **code that produces it** in React, Vue, Svelte, and plain
TypeScript. The demos call real, free, key-free public APIs, so what you see is
what the engine actually does over a network — including the failures.

Start with [Basic feed](/examples/basic-feed) if you have never used ScrollStack;
everything else builds on it.

## The list

| Example                                       | What it shows                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Basic feed](/examples/basic-feed)            | The baseline: a sentinel that loads the next page when it scrolls into view.         |
| [Pagination strategies](/examples/pagination) | Cursor, offset, and page-number — one engine, three `getNextPageParam`s.             |
| [Errors and retry](/examples/retry)           | Backoff, a manual retry, and why a failed load-more keeps the rows you already have. |
| [Manual controls](/examples/manual-controls)  | `loadNextPage()`, `reset()`, and a load-more button instead of a sentinel.           |
| [Cancellation](/examples/cancellation)        | In-flight requests aborted on reset, and stale responses made inert.                 |
| [Horizontal rail](/examples/horizontal)       | A carousel: same engine, `root` scoped to the scroll container.                      |
| [Virtual list](/examples/virtual)             | 10,000 rows, a dozen in the DOM — and virtualization with paging on top.             |
| [Devtools](/examples/devtools)                | The inspector panel: live state, an event timeline, manual controls.                 |
| [Events and plugins](/examples/events)        | Lifecycle events, and a plugin that turns them into behavior.                        |

## Reading the code blocks

Each block is a complete component, not a fragment — copy it into a file and it
runs. Two things are deliberately left out of every one of them: styling, which is
yours, and error UI beyond what the example is about.

The adapters differ only in how a framework binds a store, so the same three
options appear in all four blocks:

```ts
{
  initialPageParam, // what to fetch first
  fetchPage,        // how to fetch one page
  getNextPageParam, // where the next page param comes from — null ends the list
}
```

If you are looking for the reference rather than a worked example, the API pages
are at [`@scrollstackjs/core`](/api/core) and the adapters beside it.
