# `@scrollstackjs/devtools` — build plan

> **Status: v1 shipped** as `packages/devtools` — 25 tests, `tsc` clean, no changes
> to core. Tools 1–5 below are built; **tool 6 (sentinel overlay) was deferred**,
> because it is the only one that can't be done through the engine's public API.
> This document is kept as the design record and the plan for what's left.

A floating, dev-only panel that shows what the engine is doing in real time —
current state, the timeline of every load, and buttons to drive the engine by hand.
Think TanStack Query Devtools, scaled down to ScrollStack's surface.

## Why this one first

Of the five roadmap feature packages, devtools is the only one that needs **zero
changes to core**. Everything it reads is already exported:

| What devtools needs         | Already available                                      |
| --------------------------- | ------------------------------------------------------ |
| Current state               | `getSnapshot()` — stable reference until state changes |
| Change notifications        | `subscribe(listener)` → unsubscribe                    |
| Lifecycle timeline          | `on('loadStart' \| 'success' \| 'error' \| 'reset')`   |
| Manual control              | `loadNextPage()` · `retry()` · `reset()`               |
| Registration without wiring | `plugins: [...]` (`ScrollStackPlugin` type)            |

`persist` needs a hydration seam, `pull-refresh` needs `refetch()`, alternative
triggers need an injection point in the engine, and `virtual` is a big lift.
Devtools needs none of that.

## What ships in the panel

Six tools. Each one is listed with the core API it reads, so nothing here is
speculative about what the engine can actually provide.

### 1. State inspector

Live view of every field on `InfiniteScrollSnapshot`, updated on `subscribe`:

- **The two axes**, side by side: `status` (`idle` / `pending` / `success` / `error`)
  and `fetchStatus` (`idle` / `fetching`). Showing them together is the point —
  ADR-003 exists because these are orthogonal, and "success + fetching" is the state
  people misread most.
- **`pages.length`**, `pageParams` as a list, and `hasNextPage`.
- **`error`** (message + stack when it's an `Error`) and `failureCount`.
- **Derived booleans** — `isIdle` / `isLoading` / `isSuccess` / `isError` /
  `isFetching` / `isFetchingNextPage` — as a row of lit/unlit chips, so the exact
  combination is readable at a glance.

### 2. Event timeline

A scrolling log fed by `on()`, newest at the top, capped by a ring buffer
(`maxEvents`, default 100):

| Event       | Row shows                                                             |
| ----------- | --------------------------------------------------------------------- |
| `loadStart` | `pageParam`, timestamp                                                |
| `success`   | `pageParam`, resulting `pages.length`, duration since its `loadStart` |
| `error`     | `pageParam`, the error message, `failureCount` at the time            |
| `reset`     | a divider row                                                         |

Duration comes from pairing each `success`/`error` with the preceding `loadStart`.
Rows are colour-coded and clickable — clicking one pins the payload in the detail
pane below.

### 3. Page explorer

One expandable row per loaded page: the `pageParam` that fetched it, and the page
data itself in a collapsible JSON tree. This is where you confirm that
`getNextPageParam` is returning what you think it is — including the ADR-002 case
where `0` or `''` is a _valid_ param and not "no more pages".

### 4. Manual controls

Four buttons wired straight to the engine:

- **Load next page** — `loadNextPage()`, disabled when `!hasNextPage` or `isFetching`.
- **Retry** — `retry()`, enabled only when `error !== null`.
- **Reset** — `reset()`.
- **Pause auto-load** — calls `destroyObserver()` to detach the sentinel, so you can
  step through pagination by hand without the observer refilling the list. Toggling
  it back on re-observes the last known target.

Every call is fired as `void engine.loadNextPage()` — these return promises and
`typescript/no-floating-promises` is `error` in the root lint config.

### 5. Load-more error indicator

A dedicated readout for the ADR-003 case, because it is the single most confusing
state in the library: `error !== null && pages.length > 0 && !isFetching` means
_"the list is fine, the last page failed"_ — `status` stays `'success'`. The panel
labels this explicitly as **"load-more failed (data intact)"** and distinguishes it
from a first-load failure, which shows as **"first load failed (no data)"**.

### 6. Sentinel overlay (optional toggle)

Draws a translucent outline over the element passed to `observeTarget`, plus the
effective `rootMargin` box. Two of the three gotchas in [`AGENTS.md`](./AGENTS.md)
are sentinel-geometry problems — a zero-width flex item never intersects, and a page
that doesn't push the sentinel out of view never re-triggers. Seeing the box makes
both obvious in a second.

Requires tracking the observed element; devtools can wrap `observeTarget` on the
instance it's given, or — cleaner — core can expose the current target later. **v1
ships this behind a flag, or defers it entirely** if wrapping feels too invasive.

## Architecture

Same split the rest of the repo uses: **all logic headless, rendering thin.**

```
packages/devtools/src/
  store.ts     collects snapshots + events → its own subscribe/getSnapshot store
  panel.ts     DOM rendering, Shadow DOM, styles
  index.ts     the only export barrel
```

`store.ts` is the real package. It subscribes to the engine, records the timeline,
derives durations, and exposes the same `subscribe` / `getSnapshot` shape the engine
does. `panel.ts` is a dumb renderer over it. That way a React or Vue devtools panel
can be added later without rewriting any logic — exactly the adapter pattern from
ADR-008.

### Proposed public API

```ts
import { createDevtools } from '@scrollstackjs/devtools';

const devtools = createDevtools(scroll, {
  position: 'bottom-right', // 'bottom-left' | 'top-right' | 'top-left'
  open: false, // start collapsed as a small badge
  maxEvents: 100, // ring buffer size
});

devtools.mount(document.body);
// later
devtools.destroy(); // unsubscribes from the engine and removes the DOM node
```

Plugin form, so an app can register it without touching call sites:

```ts
import { devtoolsPlugin } from '@scrollstackjs/devtools';

createInfiniteScroll({
  /* … */
  plugins: [devtoolsPlugin({ position: 'bottom-right' })],
});
```

`ScrollStackPlugin` already supports this: the plugin receives the instance and
returns a cleanup function that `destroy()` runs. Cleanup unmounts the panel.

Headless export for custom UIs:

```ts
import { createDevtoolsStore } from '@scrollstackjs/devtools';

const store = createDevtoolsStore(scroll);
store.subscribe(() => render(store.getSnapshot())); // { snapshot, events }
```

### Rules this package must not break

- **No engine logic here** (invariant 1). Devtools reads state and forwards the four
  existing commands. It never computes what the engine should compute.
- **Read-only by default.** Nothing mutates engine state unless the user clicks a
  control.
- **SSR-safe** (invariant 7). No `window` / `document` at module scope — `mount()` is
  the only place DOM is touched, and `createDevtoolsStore` must work in `node`.
- **Zero runtime dependencies** apart from `@scrollstackjs/core` (invariant 8). No CSS
  framework, no JSON-viewer library. The tree view is ~40 lines.
- **Shadow DOM for the panel**, with styles in a single injected `<style>`. The host
  app's CSS must not leak in, and the panel's must not leak out.
- **No side effects on import.** `sideEffects: false`, no auto-mount — importing the
  package must be free so bundlers can drop it from production builds.
- **It's dev-only**, so it is _not_ held to the core gzip budget. It must still be
  trivially strippable: guard the mount behind `import.meta.env.DEV` in app code.

## Package skeleton

Mirror `packages/svelte` — it's the smallest existing package. Files to create:

```
packages/devtools/
  package.json          name @scrollstackjs/devtools, version 0.1.0,
                        dependencies: { "@scrollstackjs/core": "workspace:^" },
                        files: ["dist"], sideEffects: false, exports map,
                        scripts identical to the other packages
  tsconfig.json         extends ../../tsconfig.base.json, noEmit, include src+tests
  tsconfig.build.json   rootDir src, outDir dist
  vitest.config.ts      environment: 'jsdom', include tests/**/*.test.ts
  .oxlintrc.json        extends ["../../.oxlintrc.json"]
  .oxfmtrc.json         the shared block copied verbatim (see below)
  README.md
  src/{store,panel,index}.ts
  tests/*.test.ts
```

Two traps from [`CONTRIBUTING.md`](./CONTRIBUTING.md) that bite here specifically:

- **oxfmt has no `extends`.** The nearest `.oxfmtrc.json` _replaces_ the root one, so
  the new file repeats the shared option block verbatim. Today it's "change one,
  change all nine" — this makes it **ten**. Update that count in `CONTRIBUTING.md`
  and `AGENTS.md` when the package lands.
- **`packages/*` use semicolons**, unlike `examples/*` and `docs/`.

No new workspace glob is needed — `pnpm-workspace.yaml` already matches `packages/*`.

## Tests

jsdom environment, `tests/*.test.ts`, importing from `../src/index`. Cover the store,
not pixels:

- Timeline records `loadStart` → `success` in order, with a computed duration.
- A failed page records `error` with the right `failureCount`, and the store reports
  the load-more case (`pages.length > 0`, `status: 'success'`) distinctly from a
  first-load failure.
- Ring buffer caps at `maxEvents` and drops oldest first.
- `destroy()` unsubscribes from the engine and removes the DOM node — assert the
  engine has no listeners left and that later state changes don't touch the store.
- Engine `destroy()` runs the plugin cleanup (plugin form).
- Import is SSR-safe: `createDevtoolsStore` constructs under `environment: 'node'`
  without touching `document`.

Use fake timers for anything involving retry timing, and `deferred()` from
`tests/helpers.ts` to interleave async steps — same as core's suite.

## When it lands

- `pnpm run verify` and `pnpm run check` clean.
- TSDoc with a runnable `@example` on `createDevtools`, `createDevtoolsStore`, and
  `devtoolsPlugin`.
- `STATUS.md`: move devtools out of the roadmap into the verified table, with real
  proof (tests passing, `tsc` clean). No aspirational entry before that.
- `docs/`: a new `docs/docs/api/devtools.md` page plus a sidebar entry in
  `docs/.vitepress/config.ts`, and a mention in the events-and-plugins guide.
- `README.md` layout block and the roadmap list in `CONTRIBUTING.md`.
- No ADR needed — ADR-001 already sanctions capabilities as separate packages. An ADR
  _is_ needed if v1 ends up wrapping `observeTarget` for the sentinel overlay, since
  that touches the engine contract.

## Open questions — decide before coding

1. **One instance or many?** v1 assumes a single engine per panel. Multi-instance
   (tabs across several feeds) is more useful in real apps but roughly doubles the UI.
2. **Sentinel overlay in v1?** It's the most valuable tool for debugging and the only
   one needing anything beyond the public API. Ship it, flag it, or defer it.
3. **Vanilla-only panel, or a React one too?** Vanilla + Shadow DOM works everywhere,
   including Vue and Svelte apps. A React panel is nicer to maintain but only serves
   React users, and adds a peer dependency.
4. **Time-travel?** Snapshots are immutable and cheap to keep, so replaying state
   history is technically easy — but restoring one would need a core API that doesn't
   exist. Inspect-only for v1.
