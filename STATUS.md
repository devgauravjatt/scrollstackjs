# Build Status

What is actually built and verified in this repo, and what is still on the roadmap.

No aspirational checkmarks. Every entry in the table below was compiled, type-checked,
and tested in place on a current toolchain — TypeScript 7, Vitest 4, React 19, Vue 3,
Svelte 5 — via **pnpm workspaces**.

## Verified

| Package / artifact        | Tests | Size (gzipped)                           |
| ------------------------- | ----- | ---------------------------------------- |
| `@scrollstackjs/core`     | 35    | **1.91 KB** (bundled + minified)         |
| `@scrollstackjs/react`    | 6     | **0.32 KB** + **0.35 KB** for `/virtual` |
| `@scrollstackjs/vue`      | 8     | **0.29 KB** + **0.35 KB** for `/virtual` |
| `@scrollstackjs/svelte`   | 10    | **0.25 KB** + **0.27 KB** for `/virtual` |
| `@scrollstackjs/virtual`  | 64    | **2.70 KB** (bundled + minified)         |
| `@scrollstackjs/devtools` | 31    | dev-only — not held to the budget        |

Adapter sizes exclude peers and core. `/virtual` is a separate entry point, so an app
that never imports it pays nothing for it — and `@scrollstackjs/virtual` is an
_optional_ peer dependency, not installed unless you ask for it.

**Total: 154 tests across 22 test files.** All six packages emit `.d.ts`, pass
`tsc --noEmit`, and build in topological order via `pnpm -r build` (core first, then
the adapters that compile against its `dist/`).

Core's budget is `< 5 KB`; it currently sits at **38%** of that. The adapters carry no
logic worth measuring — that is the point of ADR-008. Virtualization sits outside that
budget by design: it is a separate package nobody pays for unless they import it
(ADR-001, ADR-009).

### Apps and site

| Artifact                                | State                   | What was checked                                                                                                        |
| --------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `examples/{react,vue,svelte}-live-demo` | **Built & verified**    | All 7 features per framework, Tailwind CSS v4, real public APIs; `vite build` clean, headless-Chrome                    |
| `examples/react-live-demo-with-devtool` | **Built & verified**    | The React demo plus `@scrollstackjs/devtools` on the feed engine; `tsc --noEmit` and `vite build` clean                 |
| `docs/`                                 | **Built & deployed**    | VitePress — 7 guides, 5 API pages, tutorial, live-demo page; builds clean with no dead links                            |
| `docs/` demos                           | **Verified in-browser** | 8 live `@scrollstackjs/vue` demos against Rick and Morty / PokéAPI / JSONPlaceholder, including the real devtools panel |

The site is published to <https://scrollstack.js.org> by `.github/workflows/docs.yml`.

### What the core engine does

- Pluggable pagination through one `getNextPageParam` — cursor, offset, and
  page-number strategies all tested against the same engine (ADR-002).
- Two-axis state machine (`status` × `fetchStatus`) with derived booleans, and
  referentially stable snapshots — safe for `useSyncExternalStore` (ADR-003, ADR-004).
- Concurrency safety via a generation counter plus `AbortController`. Stale results
  after `reset()` / `destroy()` are discarded, in-flight requests are aborted, and an
  abort is a cancellation rather than a failure (ADR-005).
- Retry configurable as `boolean | number | fn`, exponential backoff by default, with
  both the automatic and the manual `retry()` path tested under fake timers.
- Load-more failures keep the loaded pages and `success` status while still surfacing
  `error`, so a retry affordance can be rendered without losing the list.
- An SSR-guarded IntersectionObserver trigger behind the swappable `Trigger` contract.
- Event emitter, lifecycle callbacks, and a plugin system with cleanup on destroy.
- SSR-safe throughout: core constructs and runs with no DOM.

### What the virtualizer does

- Renders a window instead of a list: binary-searched range, configurable `overscan`,
  padding and gaps, horizontal or vertical.
- Dynamic row measurement through `measureElement` + a `ResizeObserver`, cached per
  item key so a measured row keeps its size when the list is re-ordered. A size change
  re-stacks only the rows below it.
- Scroll compensation when a row _above_ the viewport measures differently, so the
  visible rows don't jump.
- Scrolls an element or the whole page (`window`), with `scrollMargin` for a list that
  starts part-way down it.
- `scrollToIndex` with `'auto' | 'start' | 'center' | 'end'` alignment, instant or
  smooth; `getOffsetForIndex` for doing it yourself.
- Snapshots change only when the _rendered window_ does, so a fling costs binary
  searches rather than renders (ADR-009).
- `connectInfiniteScroll` pairs it with an engine, replacing the sentinel a virtual
  list cannot render — including the first load, with guards against re-triggering a
  failed load or stacking duplicate requests.
- SSR-safe: renders from `initialViewport` with no DOM, no `ResizeObserver`, and no
  scroll container.

### What the adapters do

All three bind the same two engine methods — `subscribe` and `getSnapshot` — and add
nothing else (ADR-008). Each also exposes a `/virtual` entry point binding the
virtualizer through the same two methods — `useVirtualizer` (React, Vue) and
`createVirtualizer` (Svelte).

- **React** — `useInfiniteScroll(options)` over `useSyncExternalStore`. Returns the
  snapshot fields plus `{ ref, loadNextPage, retry, reset, engine }`.
- **Vue** — `useInfiniteScroll(options)` mirrors the snapshot into a `shallowRef` and
  cleans up on scope dispose. Returns `{ state, target, loadNextPage, retry, reset,
engine }`; bind the sentinel with `:ref="target"`.
- **Svelte** — `createInfiniteScroll(options)` returns a value that _is_ a store
  (`$scroll` is the snapshot), plus a `use:scroll.target` action and the controls.

## Roadmap

Deliberately not stubbed. Each item builds on the contracts core already exports.

**Adapters** — Solid · Qwik · Preact · Vanilla · Astro island wrapper. The pattern is
proven three ways (React hook, Vue composable, Svelte store), so these are mechanical.

**Feature packages**, separate per ADR-001 — `@scrollstackjs/persist` ·
`@scrollstackjs/pull-refresh` · alternative `Trigger` implementations (scroll-event,
manual). `@scrollstackjs/virtual` shipped; see above.

**Virtualization follow-ups.** The package covers single-axis lists. Deliberately not
started: grids and multi-column lanes · sticky headers · reverse (bottom-anchored)
lists for chat · a live demo in `examples/` and `docs/demo` (the guide has runnable
code, but nothing on the demo page renders a virtual list yet).

**Devtools follow-ups.** The panel shipped, but one tool was deferred:

- **Sentinel overlay** — draw a translucent outline over the observed element and its
  effective `rootMargin` box. Two of the three sentinel gotchas in
  [`AGENTS.md`](./AGENTS.md#gotchas) are geometry problems that this would make obvious
  instantly. It is the only devtools feature that cannot be built on the engine's
  public API: it needs the currently observed element. Either devtools wraps
  `observeTarget` on the instance it is handed, or core exposes the target. The second
  is cleaner and would need an ADR, since it changes the engine contract.
- **Multi-instance panel** — one panel per engine today; tabs across several feeds are
  more useful in real apps but roughly double the UI.
- **Time-travel** — snapshots are immutable and cheap to retain, so recording history
  is easy; _restoring_ one needs a core API that does not exist. Inspect-only for now.

**Core follow-ups** — `refetch()` / reload-from-first-page · bi-directional
(`getPreviousPageParam`) pagination · a finer `isFetchNextPageError` signal if it earns
its keep · reactive options in the React adapter, which reads options once at mount.

**Release tooling** — switch each package's `build` to `tsup` for proper ESM extension
resolution (ADR-007) · add `size-limit` to CI to enforce the gzip budgets above · run
`vitest --coverage` toward the 95% target · add a CI workflow that runs the test suite
on pull requests, which does not exist yet.

## Run it

```bash
pnpm install
pnpm run build       # all five packages, core first
pnpm test            # 76 tests
pnpm run typecheck
pnpm run verify      # build + typecheck + test in one shot

# examples — build the packages first
pnpm --filter @scrollstack-example/react-live-demo dev
pnpm --filter @scrollstack-example/vue-live-demo dev
pnpm --filter @scrollstack-example/svelte-live-demo dev
pnpm --filter @scrollstack-example/react-live-demo-with-devtool dev

# docs site — a separate pnpm project, installed on its own
cd docs && pnpm install && pnpm run dev
```
