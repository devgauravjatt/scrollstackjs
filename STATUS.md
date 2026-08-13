# Build Status

What's actually built and verified in this repo, and what's on the roadmap.
No aspirational checkmarks — every "done" below was compiled and tested in place
with **pnpm workspaces** on a current toolchain (TypeScript 7, Vitest 4, React 19,
Vue 3, Svelte 5).

## Verified (compiles, type-checks, tested)

| Package / artifact                      | State                   | Proof                                                                                                                                      |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@scrollstackjs/core`                   | **Built**               | 35 tests pass; `tsc` clean; `.d.ts` emitted; **1.92 KB** gzipped (min+bundled)                                                             |
| `@scrollstackjs/react`                  | **Built**               | 2 tests pass; `tsc` clean; `.d.ts` emitted; **0.32 KB** gzipped (excl. peers)                                                              |
| `@scrollstackjs/vue`                    | **Built**               | 4 tests pass; `tsc` clean; `.d.ts` emitted; thin wrapper, well under budget                                                                |
| `@scrollstackjs/svelte`                 | **Built**               | 4 tests pass; `tsc` clean; `.d.ts` emitted; thin wrapper, well under budget                                                                |
| `examples/{react,vue,svelte}-live-demo` | **Built & verified**    | All 7 features per framework, Tailwind CSS v4, real public APIs; `vite build` clean and headless-Chrome checked                            |
| `docs/`                                 | **Built**               | VitePress site — 7 guides + 4 API pages + a live demo page; `pnpm run build` clean, no dead links                                          |
| `docs/` demos                           | **Verified in-browser** | 7 live `@scrollstackjs/vue` demos against public APIs (Rick and Morty / PokéAPI / JSONPlaceholder); headless-Chrome check loads real pages |

**Total: 45 tests passing across 11 test files.** All four packages build in
topological order via `pnpm -r build` (core first, then adapters, then the
example apps).

### What the core engine does

- Pluggable pagination via one `getNextPageParam` — cursor, offset, and
  page-number strategies all tested against the same engine.
- Two-axis state machine (`status` × `fetchStatus`) with derived booleans;
  referentially stable snapshots (safe for `useSyncExternalStore` and equivalents).
- Concurrency safety: generation counter + `AbortController`. Stale results after
  `reset()`/`destroy()` are discarded; in-flight requests are aborted; aborts are
  not counted as failures.
- Retry: configurable (`boolean | number | fn`) with exponential backoff by
  default; automatic _and_ manual (`retry()`) paths tested with fake timers.
- Load-more failures keep loaded pages and `success` status while surfacing
  `error` for a retry affordance.
- IntersectionObserver trigger (SSR-guarded) behind a swappable `Trigger` contract.
- Event emitter, lifecycle callbacks, plugin system with cleanup-on-destroy.
- SSR-safe: constructs and runs without a DOM.

### What the three adapters do (all bind to the same `subscribe`/`getSnapshot` core)

- **React** — `useInfiniteScroll(options)` via `useSyncExternalStore`. Returns the
  snapshot fields + `{ ref, loadNextPage, retry, reset, engine }`.
- **Vue** — `useInfiniteScroll(options)` mirrors the snapshot into a `shallowRef`
  (`state`), cleans up on scope dispose. Returns `{ state, target, loadNextPage,
retry, reset, engine }`; `:ref="target"` on the sentinel.
- **Svelte** — `createInfiniteScroll(options)` returns a value that _is_ a Svelte
  store (`$scroll` = snapshot) plus a `use:scroll.target` action and controls.

## Not yet built — roadmap

Deliberately _not_ stubbed. Each builds on the core contracts above.

**Adapters:** Solid · Qwik · Preact · Vanilla · Astro island wrapper. (Pattern is
now proven three ways — React hook, Vue composable, Svelte store — so these are
mechanical.)

**Feature packages** (separate, per ADR-001): `@scrollstackjs/virtual` ·
`@scrollstackjs/persist` · `@scrollstackjs/pull-refresh` · `@scrollstackjs/devtools` ·
alternative `Trigger` implementations (scroll-event, manual).

**Core follow-ups:** `refetch()` / reload-from-first-page; bi-directional
(`getPreviousPageParam`) pagination; finer `isFetchNextPageError` signal if needed;
reactive options in the React adapter (read once at mount today).

**Tooling for release:** swap each package's `build` to `tsup` for proper ESM
extension resolution (ADR-007); add `size-limit` to CI to enforce gzip budgets;
`vitest run --coverage` toward the 95% target.

## Run it

```bash
pnpm install
pnpm run build       # builds all four packages (core first)
pnpm test            # 44 tests
pnpm run typecheck   # all four packages
pnpm run verify      # build + typecheck + test in one shot

# examples (after building the packages)
# full feature demos — all seven demos per framework, Tailwind, real APIs
pnpm --filter @scrollstack-example/react-live-demo dev
pnpm --filter @scrollstack-example/vue-live-demo dev
pnpm --filter @scrollstack-example/svelte-live-demo dev

# docs site (installs separately — it is not part of the workspace)
cd docs && pnpm install && pnpm run dev
```
