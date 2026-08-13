# AGENTS.md

Working notes for coding agents in this repo. This file is the deep reference:
invariants, gotchas, and the per-file source map. The human-facing docs are
[`README.md`](./README.md) (usage), [`CONTRIBUTING.md`](./CONTRIBUTING.md) (the short
path to landing a change), [`DECISIONS.md`](./DECISIONS.md) (why the architecture is
the way it is), and [`STATUS.md`](./STATUS.md) (built vs. roadmap).

**Read `DECISIONS.md` before changing engine behavior.** Most "obvious improvements"
already have an ADR explaining why they were rejected.

## Commands

```bash
pnpm install
pnpm run build       # tsc per package, topological (core before adapters)
pnpm test            # 76 tests / 14 files across the five packages
pnpm run typecheck   # tsc --noEmit per package
pnpm run verify      # build + typecheck + test — run this before declaring done
pnpm run lint        # oxlint over packages/ + examples/ — type-aware
pnpm run lint:docs   # docs/ separately (needs `cd docs && pnpm install` first)
pnpm run format      # oxfmt --write; `format:check` for CI
pnpm run check       # lint + format:check
```

**Linting is type-aware** (`options.typeAware` in the root `.oxlintrc.json`, powered
by the `oxlint-tsgolint` devDependency), so it needs the same things `typecheck`
does: `packages/core/dist` must exist before the adapters lint clean. `typeAware`
is honoured **only in the root config** — it can't be scoped per package — so it
applies to whatever paths a run is pointed at. That's why `lint` targets
`packages examples` (always provisioned by the root install) and `docs` has its own
script: type-aware linting can't resolve types there until `docs/` is installed.

Single package: `pnpm --filter @scrollstackjs/core test`.
Single test file: `pnpm --filter @scrollstackjs/core exec vitest run tests/retry.test.ts`.

**Adapters compile against `packages/core/dist`, not its source.** After editing
core, run `pnpm --filter @scrollstackjs/core build` before typechecking or testing an
adapter, or you will chase phantom type errors.

**Examples are not covered by `pnpm run typecheck`** — they only define a `dev`
script. Check one explicitly:

```bash
pnpm --filter @scrollstack-example/react-live-demo exec tsc -p tsconfig.json --noEmit
pnpm --filter @scrollstack-example/react-live-demo dev   # needs packages built first
```

**`docs/` is a separate pnpm project**, not a workspace member — it has its own
`pnpm-workspace.yaml` so a VitePress upgrade can't perturb the library build.
Root `pnpm install` does not touch it:

```bash
cd docs && pnpm install && pnpm run build   # fails the build on dead links
```

**There is no CI workflow running the test suite on pull requests.** `pnpm run verify`
on your machine is the only gate. The one workflow that exists deploys the docs.

## Docs deployment

The site deploys to <https://scrollstack.js.org> via `.github/workflows/docs.yml`
(GitHub Pages, Actions-based publishing). Two things there are load-bearing:

- **Build order.** Root `pnpm run build` runs first, because docs resolves
  `@scrollstackjs/{core,vue}` through `link:../packages/*` → `dist/`.
- **`base` stays `'/'`.** The custom domain serves the site at the root. VitePress
  bakes `base` into every asset URL at build time and has no relative-base mode, so
  building with `DOCS_BASE=/scrollstackjs/` and serving from the apex domain 404s
  every stylesheet, script, and font while `index.html` itself still returns 200.
  That env var exists only for building the bare `…github.io/scrollstackjs/` URL.

`docs/docs/public/CNAME` is js.org's proof of ownership. Under Actions publishing
GitHub reads the custom domain from repo settings, so don't rely on that file alone
if the domain ever needs re-attaching.

## Layout

```
packages/
  core/     @scrollstackjs/core      engine, state machine, retry, observer contract
  react/    @scrollstackjs/react     useInfiniteScroll (useSyncExternalStore)
  vue/      @scrollstackjs/vue       useInfiniteScroll (shallowRef)
  svelte/   @scrollstackjs/svelte    createInfiniteScroll (returns a store)
  devtools/ @scrollstackjs/devtools  dev-only panel: store.ts (logic) + panel.ts (DOM)
examples/  {react,vue,svelte}-live-demo  — all 7 features, Tailwind v4, real APIs
           the three live demos mirror docs/demo; change one, change all three
           react-live-demo-with-devtool  — a copy of the React demo with the
           devtools panel on FeedDemo; a demo change means a fourth edit here
docs/      VitePress site — docs/docs/{guide,api}/*.md, config in .vitepress/
           .vitepress/theme/demo/*.vue are live demos built on @scrollstackjs/vue
```

The docs site links `@scrollstackjs/{core,vue}` from `packages/*/dist`, so **build
the library before building the docs** or the demo imports fail. The demos call
public APIs (Rick and Morty, PokéAPI, JSONPlaceholder) at runtime only — the
build itself needs no network.

Core source map: `engine.ts` (orchestration + all side effects) · `state.ts` (pure
reducer + snapshot derivation) · `observer.ts` (`Trigger` contract +
IntersectionObserver impl) · `retry.ts` · `emitter.ts` · `errors.ts` ·
`types.ts` (the public type surface) · `index.ts` (the only export barrel).

## Invariants — don't break these

1. **All logic lives in core.** Adapters bind exactly two methods — `subscribe`
   and `getSnapshot` — and forward `loadNextPage` / `retry` / `reset` / a sentinel
   binding. If you find yourself writing engine logic in an adapter, it belongs in
   core (ADR-008).
2. **Snapshots are referentially stable.** `getSnapshot()` returns the _same_
   object until state actually changes. Breaking this causes infinite re-renders
   in React. Never build a snapshot inside `getSnapshot` (ADR-004).
3. **`state.ts` stays pure.** No async, no side effects — the engine dispatches
   into `reduce` and owns everything else.
4. **Page params use `== null`, never truthiness.** `0` and `''` are valid page
   params (offset 0). There is a regression test in `pagination.test.ts` (ADR-002).
5. **Load-more failures keep the data.** A first-load failure → `status: 'error'`.
   A later-page failure → `status` stays `'success'`, `error` is set. Consumers
   detect it with `error !== null && pages.length > 0 && !isFetching` (ADR-003).
6. **Stale async must stay inert.** Every fetch captures `generation`; `reset()`,
   `destroy()`, and superseding fetches bump it, and a late result whose generation
   doesn't match is discarded. Aborts are _cancellations_, not failures — they
   don't increment `failureCount` or emit `error` (ADR-005).
7. **Everything is SSR-safe.** Core must construct and run with no DOM;
   `createIntersectionTrigger` returns `null` without `IntersectionObserver` and
   the engine no-ops. `ssr.test.ts` guards this — don't reach for `window` or
   `document` at module scope.
8. **Core has zero runtime dependencies** and adapters depend only on core, with
   the framework as a `peerDependency`. Keep it that way; the gzip budget
   (core < 5 KB, currently 1.91 KB) depends on it.
9. **New capabilities are new packages**, not core additions — virtualization,
   persistence, devtools, alternative `Trigger`s (ADR-001).

## Conventions

- **TypeScript strict**, plus `noUncheckedIndexedAccess` (so `arr[i]` is
  `T | undefined` — the codebase uses `!` where the index is provably safe).
- **Public API is documented with TSDoc**, including a runnable `@example` on each
  entry point. Match the existing voice: explain _why_, not what the code says.
- **`readonly` on all public data**; interfaces over type aliases for object shapes.
- **Exports go through `src/index.ts`**; types are exported with `export type`
  (`isolatedModules` is on).
- **ESM only**, extensionless relative imports (`./state`) — that's what `tsc`
  emits and what bundlers resolve. Don't add `.js` extensions.
- **Tests** live in `tests/*.test.ts(x)`, import from `../src/index`, and use
  Vitest (`node` env for core, `jsdom` for adapters and devtools). Fake timers for
  retry/backoff; `tests/helpers.ts` has `deferred()` for interleaving async.
- **Examples are inline-styled, single-file, and dependency-free** apart from the
  workspace packages — they double as documentation, so keep the comments that
  explain the non-obvious parts.
- **Lint/format is oxlint + oxfmt**, one `.oxlintrc.json` and one `.oxfmtrc.json`
  per workspace member plus the repo root. Both tools pick the _nearest_ config
  and do **not** merge it with the root one. oxlint configs therefore carry
  `"extends": ["../../.oxlintrc.json"]`; **oxfmt has no `extends`**, so each
  `.oxfmtrc.json` repeats the shared option block verbatim — change one, change
  all eleven. `packages/*` use semicolons, `examples/*` and `docs/` do not; that
  split is intentional and encoded per config.

## Gotchas

- **Adapter options are read once, at mount.** Changing `fetchPage`,
  `getNextPageParam`, or `root` across renders does not re-create the engine — call
  `reset()` or remount via a `key`. Reactive options are on the roadmap; don't
  paper over it in an example.
- **`root` must exist before the hook runs.** For a container-scoped scroll, the
  component holding the hook has to mount _inside_ an already-rendered container,
  so split the container and the hook into separate components.
- **IntersectionObserver only fires on transitions.** If a loaded page doesn't push
  the sentinel out of view, nothing re-triggers. Sentinels also need real layout
  size — a zero-width flex item never intersects.
- **`observeTarget` builds a new observer every call, and a new observer fires
  immediately if the target is already visible.** So any binding that runs more
  than once per element causes a refetch loop that ignores `retry`. Vue invokes
  function refs on _every_ patch (React callback refs and Svelte actions don't),
  which is why the Vue adapter dedupes on the observed node. Keep that guard if
  you touch it, and add the same one to any new adapter whose ref fires repeatedly.
- **`.npmrc` sets `node-linker=hoisted`** for tool compatibility, so phantom
  dependencies won't be caught locally. Declare every import in the package's
  `package.json`.
- **`dist/` is gitignored but load-bearing locally.** A fresh clone has no `dist/`,
  so `pnpm run build` comes before anything that resolves `@scrollstackjs/core`.

## Definition of done

`pnpm run verify` clean, new behavior covered by a test in the owning package, and
TSDoc updated on anything public. Then, depending on what changed:

- **Architecture** → a new ADR in `DECISIONS.md`.
- **What exists** → the table in `STATUS.md` and the layout block in `README.md`.
  Don't add aspirational entries to `STATUS.md`; it lists only what was compiled
  and tested.
- **Public API** → the relevant guide plus the matching `docs/docs/api/*` page.

`docs/docs/decisions.md` is a VitePress `@include` of the root `DECISIONS.md`, so
ADRs are edited in one place only.
