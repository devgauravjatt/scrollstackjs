# @scrollstackjs/devtools

Dev-only devtools panel for [ScrollStack](https://www.npmjs.com/package/@scrollstackjs/core).
Live engine state, an event timeline, a page explorer, and manual controls — in a
floating panel that renders inside a shadow root, so it can't collide with your app's CSS.

```bash
npm i -D @scrollstackjs/devtools
```

Register it as a plugin and forget about it — one line, every adapter, mounts and
unmounts with the engine:

```ts
import { devtoolsPlugin } from '@scrollstackjs/devtools';

createInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  plugins: import.meta.env.DEV ? [devtoolsPlugin()] : [],
});
```

The mount is deferred to a microtask, so it is safe even in React, where the adapter
builds its engine during render. One panel per `storageKey` — pass distinct keys to
watch two engines at once.

Or drive it yourself when you want a handle:

```ts
import { createDevtools } from '@scrollstackjs/devtools';

const devtools = createDevtools(scroll);
if (import.meta.env.DEV) devtools.mount();
```

## What's in the panel

- **State** — `status` and `fetchStatus` side by side (they're orthogonal, see ADR-003),
  page count, `pageParams`, `hasNextPage`, `failureCount`, and the six derived booleans.
- **Timeline** — every `loadStart` / `success` / `error` / `reset`, newest first, with the
  duration of each load. Filter by text or errors only. Ring buffer, default 100 rows.
- **Pages** — each loaded page with the `pageParam` that fetched it; the JSON is
  serialised only when you expand a row.
- **Controls** — load next page, retry, reset, and pause auto-load (detaches the sentinel
  observer so pages only load when you ask).
- **Load-more indicator** — distinguishes _"first load failed (no data)"_ from
  _"load-more failed (data intact)"_, which is the state people misread most.

Collapsed, it's a badge whose dot colour tracks the engine, so you can watch state
without opening anything.

## Options

```ts
createDevtools(scroll, {
  position: 'bottom-right', // starting corner
  open: false, // start expanded
  maxEvents: 100, // timeline ring buffer
  shortcut: 'ctrl+shift+0', // null to disable
  persist: true, // remember open state, position, size
  storageKey: 'scrollstack-devtools',
  theme: 'auto', // 'light' | 'dark'
});
```

Drag the header to move the panel, drag the bottom-right corner to resize; both are
remembered.

## Headless

`createDevtoolsStore(engine)` gives you the same data with no DOM — `subscribe` /
`getSnapshot`, returning `{ snapshot, events, phase }`. Build your own UI on it.

## Notes

- Reads `subscribe` / `getSnapshot` / `on` and forwards `loadNextPage` / `retry` /
  `reset`. It holds no engine logic and never mutates state unless you click something.
- No side effects on import and no runtime dependencies beyond `@scrollstackjs/core`,
  so a production build that never mounts it drops the whole package.
- SSR-safe: `mount()` no-ops without a DOM.

MIT
