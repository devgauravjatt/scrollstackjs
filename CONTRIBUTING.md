# Contributing to ScrollStack

Thanks for being here. ScrollStack is a small, deliberately opinionated codebase:
one tiny engine, thin adapters, and a hard budget on both size and surface area.
This guide is what you need to land a change without fighting the tooling.

This is the short path. The long one is [`AGENTS.md`](./AGENTS.md) — invariants with
their rationale, the per-file source map, and the gotchas that cost the most time.
Alongside those: [`README.md`](./README.md) for what the library is,
[`DECISIONS.md`](./DECISIONS.md) for **why the architecture is the way it is**, and
[`STATUS.md`](./STATUS.md) for what is built versus roadmap.

## Ways to help

- **Bug reports.** Open an issue at
  [github.com/devgauravjatt/scrollstackjs/issues](https://github.com/devgauravjatt/scrollstackjs/issues)
  with the package and version, the framework adapter, and a minimal reproduction —
  ideally a trimmed-down version of one of the `examples/*-live-demo` apps.
- **Documentation.** The VitePress site under [`docs/`](./docs) is the main
  user-facing surface. Typos, unclear guides, and missing examples are all fair game.
- **Bug fixes and tests.** A failing test that pins down a bug is a complete and
  very welcome contribution on its own.
- **New adapters and feature packages.** These are bigger — see
  [Bigger changes](#bigger-changes) first.

## Before you start

**Open an issue first for anything that changes behavior, the public API, or the
architecture.** Small fixes, docs, and tests can go straight to a pull request.

The reason is ADR-001: this is a lean core plus a constellation of packages, and
"just add it to core" is usually the wrong answer even when the feature is right.

## Setup

```bash
git clone https://github.com/devgauravjatt/scrollstackjs.git
cd scrollstackjs
pnpm install
pnpm run build   # do this first — see below
```

pnpm is pinned by the `packageManager` field (currently 11.21.0); `corepack enable`
picks up the right version automatically. Node has no `engines` pin — CI builds on
Node 22, and any current LTS works.

**`pnpm run build` before anything else.** `dist/` is gitignored but load-bearing:
adapters compile against `packages/core/dist`, not core's source, and so do the docs
site and the examples. On a fresh clone nothing resolves `@scrollstackjs/core` until
core has been built once. After editing core, rebuild it before you typecheck, test,
or lint an adapter — otherwise you'll chase phantom type errors.

## The development loop

```bash
pnpm run build       # tsc per package, topological (core before adapters)
pnpm test            # 154 tests / 22 files across the six packages
pnpm run typecheck   # tsc --noEmit per package
pnpm run verify      # build + typecheck + test — the gate before you open a PR
pnpm run lint        # oxlint over packages/ + examples/ — type-aware
pnpm run format      # oxfmt --write; format:check for a read-only run
pnpm run check       # lint + format:check
```

Narrow the loop while you work:

```bash
pnpm --filter @scrollstackjs/core test
pnpm --filter @scrollstackjs/core exec vitest run tests/retry.test.ts
```

**Linting is type-aware**, so it needs the same built `dist/` that typechecking does.
`typeAware` is honoured only in the root `.oxlintrc.json` and can't be scoped per
package, which is why `lint` targets `packages examples` and `docs` has its own
`lint:docs` script.

**Examples aren't covered by `pnpm run typecheck`** — they only define a `dev`
script. If you touch one, check it explicitly:

```bash
pnpm --filter @scrollstack-example/react-live-demo exec tsc -p tsconfig.json --noEmit
pnpm --filter @scrollstack-example/react-live-demo dev   # needs packages built first
```

**`docs/` is a separate pnpm project**, not a workspace member — it has its own
`pnpm-workspace.yaml` so a VitePress upgrade can't perturb the library build. Root
`pnpm install` does not touch it:

```bash
cd docs && pnpm install && pnpm run dev     # http://localhost:5173
cd docs && pnpm run build                   # fails the build on dead links
```

The docs demos resolve `@scrollstackjs/{core,vue}` through `link:../packages/*` →
`dist/`, so build the library before building the docs.

> **CI only builds and deploys the docs site.** No workflow runs the test suite on
> pull requests yet, so **`pnpm run verify` on your machine is the real gate.**
> Please run it.

## Layout

```
packages/
  core/     @scrollstackjs/core      engine, state machine, retry, observer contract
  react/    @scrollstackjs/react     useInfiniteScroll (useSyncExternalStore)
  vue/      @scrollstackjs/vue       useInfiniteScroll (shallowRef)
  svelte/   @scrollstackjs/svelte    createInfiniteScroll (returns a store)
            each adapter also has src/virtual.ts -> the `/virtual` entry point
  virtual/  @scrollstackjs/virtual   virtualizer: layout.ts (pure) + virtualizer.ts
                                     (side effects) + scroller.ts (element vs window)
  devtools/ @scrollstackjs/devtools  dev-only panel: store.ts (logic) + panel.ts (DOM)
examples/  {react,vue,svelte}-live-demo   — all 7 features, Tailwind v4, real APIs
           react-live-demo-with-devtool   — the React demo plus the devtools panel
docs/      VitePress site — docs/docs/{guide,api}/*.md, config in .vitepress/
```

Inside core: `engine.ts` (orchestration and all side effects) · `state.ts` (pure
reducer + snapshot derivation) · `observer.ts` (the `Trigger` contract and the
IntersectionObserver implementation) · `retry.ts` · `emitter.ts` · `errors.ts` ·
`types.ts` (the public type surface) · `index.ts` (the only export barrel).

Inside virtual, the same split one level over: `layout.ts` is pure geometry,
`virtualizer.ts` owns measurement and listeners, `scroller.ts` hides the difference
between a scroll container and `window`, and `connect.ts` bridges to a core engine.

The three live demos mirror `docs/demo` — **change one, change all three plus the
docs demo**, or they drift. If the change touches `FeedDemo`, that's a fourth edit in
`react-live-demo-with-devtool`.

## Invariants

These are load-bearing. A change that breaks one needs an ADR arguing the case, not
just a passing test suite. **The authoritative list, with the reasoning behind each,
is in [`AGENTS.md`](./AGENTS.md#invariants--dont-break-these)** — read it before
changing engine behavior. The three newcomers trip on most:

1. **All logic lives in core.** Adapters bind exactly two methods — `subscribe` and
   `getSnapshot` — and forward `loadNextPage` / `retry` / `reset` / a sentinel
   binding. Engine logic in an adapter belongs in core (ADR-008).
2. **Snapshots are referentially stable.** `getSnapshot()` returns the _same_ object
   until state actually changes. Building a snapshot inside `getSnapshot` causes
   infinite re-renders in React (ADR-004).
3. **Page params use `== null`, never truthiness.** `0` and `''` are valid page
   params. There's a regression test for exactly this (ADR-002).

## Code style

Formatting is automated — run `pnpm run format` and don't hand-tune. The rest:

- **TypeScript strict**, plus `noUncheckedIndexedAccess` (so `arr[i]` is
  `T | undefined`; the codebase uses `!` where the index is provably safe).
- **Public API carries TSDoc**, including a runnable `@example` on each entry point.
  Match the existing voice: explain _why_, not what the code already says.
- **`readonly` on all public data**; interfaces over type aliases for object shapes.
- **Exports go through `src/index.ts`**, with types exported via `export type`
  (`isolatedModules` is on).
- **ESM only, extensionless relative imports** (`./state`). Don't add `.js`.
- **Declare every import** in the package's own `package.json` — `.npmrc` sets
  `node-linker=hoisted`, so phantom dependencies won't be caught locally.
- **Examples are single-file and dependency-free** apart from the workspace packages
  and their own styling. They double as documentation; keep the comments that
  explain the non-obvious parts.
- **oxlint + oxfmt configs don't merge.** Both tools pick the _nearest_ config only.
  oxlint configs carry `"extends": ["../../.oxlintrc.json"]`; oxfmt has no `extends`,
  so each `.oxfmtrc.json` repeats the shared block verbatim — change one, change all
  eleven. `packages/*` use semicolons; `examples/*` and `docs/` don't. That split is
  intentional.

## Tests

Tests live in `tests/*.test.ts(x)` inside the package they cover, import from
`../src/index`, and run on Vitest — `node` environment for core, `jsdom` for the
adapters and devtools. Use fake timers for anything touching retry or backoff, and
`tests/helpers.ts`'s `deferred()` when you need to interleave async steps.

**Every behavior change needs a test in the package that owns the behavior** — which,
per invariant 1, usually means core rather than the adapter you noticed it in.

## Commits and pull requests

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `perf:`, `build:`, `ci:`, `chore:`,
with an optional scope — e.g. `fix(vue): dedupe repeated ref invocations`. Keep the
subject imperative and under ~72 characters.

Before opening a pull request:

- [ ] `pnpm run verify` is clean (build + typecheck + test).
- [ ] `pnpm run check` is clean (lint + format).
- [ ] New behavior is covered by a test in the owning package.
- [ ] TSDoc is updated on anything public.
- [ ] Public API changes are reflected in `docs/` — both the relevant guide and the
      matching `docs/docs/api/*` page.
- [ ] If what exists changed, the table in `STATUS.md` and the layout block in
      `README.md` are updated. `STATUS.md` lists only what was actually compiled and
      tested — no aspirational entries.
- [ ] If the architecture changed, there's a new ADR in `DECISIONS.md` — and _not_
      in `docs/`. The docs site is for people using the library; design rationale
      stays in the repository.

Describe what changed and why, and link the issue it addresses. Small, focused pull
requests get reviewed faster than large ones.

## Bigger changes

**New capabilities are new packages, not core additions** — virtualization,
persistence, devtools, and alternative `Trigger` implementations all build on the
contracts core already exports (ADR-001). This is what keeps the core under budget
and tree-shakeable for apps that don't use those parts.

Good places to start if you want a substantial piece to own:

- **Feature packages** — `@scrollstackjs/virtual` · `@scrollstackjs/persist` ·
  `@scrollstackjs/pull-refresh` · alternative `Trigger` implementations
  (scroll-event, manual).
- **Adapters** — Solid · Qwik · Preact · Vanilla · Astro island wrapper. The pattern
  is proven three ways now (React hook, Vue composable, Svelte store), so these are
  mostly mechanical.
- **The deferred devtools sentinel overlay**, which needs a way to read the observed
  element off the engine — the one devtools feature the public API can't reach.

None of these are stubbed. Open an issue to claim one before you start, so two people
don't build the same package. The full roadmap, including core follow-ups and release
tooling, is in [`STATUS.md`](./STATUS.md#roadmap).

**New framework adapters should stay thin**: bind `subscribe` and `getSnapshot`,
forward the commands, and add nothing else. One gotcha to inherit — `observeTarget`
builds a new observer on every call, and a new observer fires immediately if the
target is already visible, so a sentinel binding that runs more than once per element
causes a refetch loop that ignores `retry`. Vue invokes function refs on _every_
patch, which is why the Vue adapter dedupes on the observed node; add the same guard
to any adapter whose ref fires repeatedly.

## License

ScrollStack is MIT licensed. By contributing, you agree that your contributions are
licensed under the same terms — see [`LICENSE`](./LICENSE).
