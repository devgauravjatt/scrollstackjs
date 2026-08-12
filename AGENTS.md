# AGENTS.md

Working notes for coding agents in this repo. Human-facing docs live in
[`README.md`](./README.md) (usage), [`DECISIONS.md`](./DECISIONS.md) (why the
architecture is the way it is), and [`STATUS.md`](./STATUS.md) (what is built vs.
roadmap). Read `DECISIONS.md` before changing engine behavior — most "obvious
improvements" have an ADR explaining why they were rejected.

> Note: ADR-001 in `DECISIONS.md` cites an earlier `AGENTS.md` that described a
> _fat core_. That document is gone and its fat-core framing was superseded by
> ADR-001 (lean core + constellation). This file is the agent guide, not that
> design doc.

## Commands

```bash
pnpm install
pnpm run build       # tsc per package, topological (core before adapters)
pnpm test            # 45 tests / 11 files across the four packages
pnpm run typecheck   # tsc --noEmit per package
pnpm run verify      # build + typecheck + test — run this before declaring done
pnpm run lint        # oxlint over the whole repo (docs/ included)
pnpm run format      # oxfmt --write; `format:check` for CI
pnpm run check       # lint + format:check
```

Single package: `pnpm --filter @scrollstackjs/core test`.
Single test file: `pnpm --filter @scrollstackjs/core exec vitest run tests/retry.test.ts`.

**Adapters compile against `packages/core/dist`, not its source.** After editing
core, run `pnpm --filter @scrollstackjs/core build` before typechecking or testing an
adapter, or you will chase phantom type errors.

**Examples are not covered by `pnpm run typecheck`** — they only define a `dev`
script. Check one explicitly:

```bash
pnpm --filter @scrollstack-example/react-horizontal-rail exec tsc -p tsconfig.json --noEmit
pnpm --filter @scrollstack-example/react-horizontal-rail dev   # needs packages built first
```

**`docs/` is a separate pnpm project**, not a workspace member — it has its own
`pnpm-workspace.yaml` so a VitePress upgrade can't perturb the library build.
Root `pnpm install` does not touch it:

```bash
cd docs && pnpm install && pnpm run build   # fails the build on dead links
```

## Layout

```
packages/
  core/    @scrollstackjs/core    engine, state machine, retry, observer contract
  react/   @scrollstackjs/react   useInfiniteScroll (useSyncExternalStore)
  vue/     @scrollstackjs/vue     useInfiniteScroll (shallowRef)
  svelte/  @scrollstackjs/svelte  createInfiniteScroll (returns a store)
examples/  *-infinite-feed / react-horizontal-rail  — minimal quickstarts
           {react,vue,svelte}-live-demo            — all 7 features, Tailwind v4, real APIs
           the three live demos mirror docs/demo; change one, change all three
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
   (core < 5 KB, currently 1.92 KB) depends on it.
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
  Vitest (`node` env for core, `jsdom` for adapters). Fake timers for retry/backoff;
  `tests/helpers.ts` has `deferred()` for interleaving async.
- **Examples are inline-styled, single-file, and dependency-free** apart from the
  workspace packages — they double as documentation, so keep the comments that
  explain the non-obvious parts.
- **Lint/format is oxlint + oxfmt**, one `.oxlintrc.json` and one `.oxfmtrc.json`
  per workspace member plus the repo root. Both tools pick the _nearest_ config
  and do **not** merge it with the root one. oxlint configs therefore carry
  `"extends": ["../../.oxlintrc.json"]`; **oxfmt has no `extends`**, so each
  `.oxfmtrc.json` repeats the shared option block verbatim — change one, change
  all nine. `packages/*` use semicolons, `examples/*` and `docs/` do not; that
  split is intentional and encoded per config.

## Gotchas

- **Adapter options are read once, at mount.** Changing `fetchPage`,
  `getNextPageParam`, or `root` across renders does not re-create the engine — call
  `reset()` or remount via a `key`. Reactive options are on the roadmap; don't
  paper over it in an example.
- **`root` must exist before the hook runs.** For a container-scoped scroll, the
  component holding the hook has to mount _inside_ an already-rendered container —
  see the App/Rail split in
  [examples/react-horizontal-rail/src/App.tsx](examples/react-horizontal-rail/src/App.tsx).
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
TSDoc updated on anything public. If you changed the architecture, add an ADR to
`DECISIONS.md`; if you changed what exists, update the table in `STATUS.md` and the
layout block in `README.md`. Don't add aspirational entries to `STATUS.md` — it
only lists what was actually compiled and tested.

Public API changes also mean `docs/`: the guide and the matching `docs/docs/api/*`
page. `docs/docs/decisions.md` is a VitePress `@include` of the root
`DECISIONS.md`, so ADRs are edited in one place only.
