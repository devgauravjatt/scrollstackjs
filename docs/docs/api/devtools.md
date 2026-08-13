# @scrollstackjs/devtools

A dev-only panel for inspecting a running engine: live state, an event timeline, a
page explorer, and manual controls. It renders inside a shadow root, so it cannot
collide with your app's styles, and it holds no engine logic — it reads `subscribe`,
`getSnapshot` and `on`, and forwards the commands the engine already exposes.

```bash
npm i -D @scrollstackjs/devtools
```

```ts
import { devtoolsPlugin } from '@scrollstackjs/devtools'
```

Works with any adapter. The [plugin form](#devtoolsplugin) is the one-liner; use
[`createDevtools`](#createdevtools) when you want to mount and control the panel
yourself. React, Vue and Svelte also expose the engine as `engine` if you need it.

## createDevtools

```ts
function createDevtools<TData, TPageParam>(
  engine: InfiniteScroll<TData, TPageParam>,
  options?: DevtoolsOptions,
): Devtools<TData, TPageParam>
```

Nothing renders until you call `mount()`.

```ts
const scroll = createInfiniteScroll({ ... })

const devtools = createDevtools(scroll)
if (import.meta.env.DEV) devtools.mount()
```

| Member    | Type                               | Description                                         |
| --------- | ---------------------------------- | --------------------------------------------------- |
| `mount`   | `(container?: Element) => void`    | Renders into `container` (default `document.body`). |
| `unmount` | `() => void`                       | Removes the DOM node; the store keeps recording.    |
| `open`    | `() => void`                       | Expands the panel.                                  |
| `close`   | `() => void`                       | Collapses it back to the badge.                     |
| `toggle`  | `() => void`                       | Flips between the two.                              |
| `destroy` | `() => void`                       | Unmounts _and_ detaches from the engine.            |
| `store`   | `DevtoolsStore<TData, TPageParam>` | The headless store behind the panel.                |

### DevtoolsOptions

| Option       | Type                                                           | Default                  | Description                                                                   |
| ------------ | -------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `position`   | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'`         | Starting corner, before any drag.                                             |
| `open`       | `boolean`                                                      | `false`                  | Start expanded.                                                               |
| `maxEvents`  | `number`                                                       | `100`                    | Timeline ring buffer; oldest rows drop first.                                 |
| `shortcut`   | `string \| null`                                               | `'ctrl+shift+0'`         | Toggle shortcut. `null` disables it.                                          |
| `persist`    | `boolean`                                                      | `true`                   | Remember open state, position and size.                                       |
| `storageKey` | `string`                                                       | `'scrollstack-devtools'` | Panel identity: shown atop **State**, keys `localStorage`, one panel per key. |
| `theme`      | `'auto' \| 'light' \| 'dark'`                                  | `'auto'`                 | `'auto'` follows `prefers-color-scheme`.                                      |

## devtoolsPlugin

```ts
function devtoolsPlugin<TData, TPageParam>(
  options?: DevtoolsOptions,
): ScrollStackPlugin<TData, TPageParam>
```

The same panel, registered through the engine's `plugins` option so you don't touch
any call sites. It mounts with the engine, and the engine's `destroy()` tears it down.
This is the recommended form, and it works with every adapter — including React.

```ts
createInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  plugins: import.meta.env.DEV ? [devtoolsPlugin()] : [],
})
```

Through an adapter, the options are the same object:

```tsx
const { pages, ref } = useInfiniteScroll({
  initialPageParam: 0,
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  plugins: import.meta.env.DEV ? [devtoolsPlugin()] : [],
})
```

Two details make that safe. Plugins run inside `createInfiniteScroll`, which the
React adapter calls _during render_ — so the plugin defers its `mount()` to a
microtask instead of touching the DOM in the render phase. And it keeps **one panel
per `storageKey`**: if a render React later discards leaves behind an engine nobody
destroys, the surviving render's panel replaces its orphan.

The flip side: two engines that both use the default key show one panel, the newer
one. Give each its own `storageKey` to see both.

```ts
plugins: [devtoolsPlugin({ storageKey: 'feed' })]
// elsewhere
plugins: [devtoolsPlugin({ storageKey: 'comments' })]
```

Each panel shows its own key as the first row of its **State** section, above
`status`, so two open panels are never ambiguous.

Use [`createDevtools`](#createdevtools) instead when you want a handle — your own
toggle button, or the `store` in a test.

## What the panel shows

**State** — the panel's `storageKey` first, so you know which engine you're looking
at, then `status` and `fetchStatus` side by side (they are orthogonal, see
[ADR-003](/decisions)), page count, `pageParams`, `hasNextPage`, `failureCount`, and
the six derived booleans as lit/unlit chips.

**Timeline** — every `loadStart`, `success`, `error` and `reset`, newest first, with
the duration of each load and the failure count on errors. Filter by text, or show
errors only.

**Pages** — one expandable row per loaded page with the `pageParam` that fetched it.
The JSON is serialised only when you expand a row, so a large page costs nothing
until you look at it.

**Controls** — load next page, retry, reset, and pause auto-load. Pausing calls
`destroyObserver()` so the sentinel stops refilling the list and you can step through
pagination by hand.

**Load-more indicator** — the state people misread most. A first-load failure shows
as _"first load failed (no data)"_; a later-page failure shows as _"load-more failed
(data intact)"_, because per ADR-003 `status` stays `'success'` and your pages
survive.

Collapsed, the panel is a badge whose dot tracks the engine — grey idle, blue
fetching, green ready, amber load-more failure, red first-load failure.

## createDevtoolsStore

```ts
function createDevtoolsStore<TData, TPageParam>(
  engine: InfiniteScroll<TData, TPageParam>,
  options?: { maxEvents?: number },
): DevtoolsStore<TData, TPageParam>
```

The headless half — everything above with no DOM. Use it to build your own panel, or
to assert on engine behavior in tests.

```ts
const store = createDevtoolsStore(scroll)

store.subscribe(() => {
  const { snapshot, events, phase } = store.getSnapshot()
  console.log(phase, events[0])
})
```

`getSnapshot()` returns a stable reference until something changes, same contract as
the engine. `phase` is one of `'idle'`, `'firstLoad'`, `'firstLoadFailed'`, `'ready'`,
`'fetchingNext'`, `'loadMoreFailed'`, `'complete'` — the `status` × `fetchStatus`
matrix collapsed into the cases worth naming.

Call `store.destroy()` to unsubscribe, or `clearEvents()` to empty the timeline
without touching engine state.

## Keeping it out of production

The package has no side effects on import and no runtime dependencies beyond the
core, so a build that never mounts it drops the whole thing. Guard the mount with
your bundler's dev flag — `import.meta.env.DEV` in Vite — and, if you want the import
itself gone, load it dynamically:

```ts
if (import.meta.env.DEV) {
  const { createDevtools } = await import('@scrollstackjs/devtools')
  createDevtools(scroll).mount()
}
```

## Server rendering

`createDevtoolsStore` runs anywhere — no DOM required. `mount()` no-ops when there is
no `document`, so the plugin form is safe in SSR without a guard.
