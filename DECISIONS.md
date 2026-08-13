# Architecture Decisions

Short ADRs for the choices that shaped this foundation. Each is reversible —
if you disagree, this is the list to argue with.

---

## ADR-001 — Package constellation, not a fat core

**Context.** Two shapes were on the table. A _fat core_, where pagination, retry,
the state machine, every observer, events, and plugins all live inside
`@scrollstackjs/core` and nothing outside it may hold logic. Or a _constellation_
of separate feature packages (`virtual/`, `intersection/`, `paginator/`,
`persist/`, …), which is how TanStack itself is built (`@tanstack/query-core`,
`@tanstack/virtual-core`).

Both can't be literally true: if `paginator/` is its own package, pagination
isn't solely in core.

**Decision.** Constellation model, with a **lean core** that owns the _engine_
(state machine, fetch orchestration, retry, cancellation, events, plugins) and
defines _contracts_ (`Trigger`, `GetNextPageParam`) rather than bundling every
feature. Optional capabilities (virtualization, persistence, pull-to-refresh,
devtools) become separate packages built on those contracts.

**Why.** It's the only way the headline `< 5 KB` core budget is reachable, and
it matches the ecosystem being modeled. **Verified:** the built core is
**1.91 KB gzipped**, the React adapter **0.32 KB** — both well under budget.
A fat core with three observers + persistence + devtools inside it would blow
past 5 KB and couldn't be tree-shaken away by apps that don't use those parts.
`@scrollstackjs/devtools` shipped as a separate package on exactly this basis,
with no changes to core.

**Consequence.** Pagination is _not_ four hardcoded strategies (cursor / offset /
page / time). It's one function — `getNextPageParam` — and the "strategies"
become presets/recipes on top. See ADR-002.

---

## ADR-002 — One `getNextPageParam`, not four pagination strategies

**Decision.** A single user-supplied function derives the next page parameter:

```ts
getNextPageParam(lastPage, allPages, lastPageParam, allPageParams)
  => TPageParam | null | undefined   // null/undefined = no more pages
```

**Why.** Cursor, offset/limit, and page-number pagination differ only in _how
you compute the next param_ — not in engine behavior. Making that a data input
instead of a branch keeps the engine tiny and lets any pagination shape work,
including ones we didn't anticipate. (This is the TanStack Query model, chosen
deliberately.) All three strategies are exercised in `pagination.test.ts` against
the same engine.

**Consequence.** A `0` param is valid (offset 0) — the engine uses `== null`
checks, never truthiness. There's a regression test for exactly this.

---

## ADR-003 — Two-axis state: `status` × `fetchStatus`

**Decision.** State is modeled on two orthogonal axes:

- `status`: `idle | pending | success | error` — describes the _data_.
- `fetchStatus`: `idle | fetching` — describes the _network_.

Convenience booleans (`isLoading`, `isFetchingNextPage`, `isError`, …) are
derived from these.

**Why.** "Is a request in flight?" and "do I have usable data?" are independent
questions. Collapsing them into one enum forces awkward states like a single
`loading` that can't distinguish first-load from load-more. Separating them is
what makes `isFetchingNextPage` (fetching _and_ pages already exist) trivial and
correct.

**Key rule — load-more failures keep your data.** A _first-load_ failure is a
true `error` (no data to show). A _load-more_ failure keeps `status: 'success'`
(the pages you already loaded are still valid and render) but sets `error` so you
can show a retry affordance. Detect it with:
`error !== null && pages.length > 0 && !isFetching`. This is tested in
`retry.test.ts` and demonstrated in the React example.

---

## ADR-004 — Snapshots are referentially stable

**Decision.** The engine caches the snapshot object and returns the _same
reference_ from `getSnapshot()` until state actually changes.

**Why.** React's `useSyncExternalStore` calls `getSnapshot` on every render and
bails out of re-rendering only if the reference is unchanged. Returning a fresh
object each call causes infinite re-renders. Caching makes the React adapter a
few lines with no memoization gymnastics. Tested directly (`a === b` until a real
change) in `engine.test.ts`.

---

## ADR-005 — Concurrency via generation counter + AbortController

**Decision.** Every fetch captures a monotonically increasing `generation`.
`reset()`, `destroy()`, and any superseding fetch bump it. A resolved fetch whose
generation no longer matches is discarded. In parallel, an `AbortController`
signal is passed to `fetchPage` and aborted on reset/destroy.

**Why.** The classic infinite-scroll bug is a stale response landing after a
reset and resurrecting dead state. The generation guard makes stale results
inert even if `fetchPage` ignores the abort signal; the signal lets
well-behaved fetchers cancel real network work. An abort is treated as a
_cancellation_, not a failure — it doesn't count toward retries. All covered in
`concurrency.test.ts` and `cancellation.test.ts`.

---

## ADR-006 — The IntersectionObserver trigger ships in core (behind a contract)

**Decision.** Core defines a `Trigger` interface and ships one default
implementation (`createIntersectionTrigger`), SSR-guarded so it returns `null`
without a DOM. Other triggers (scroll-event, manual, mutation-based) can be
separate packages implementing the same contract.

**Why.** IntersectionObserver is the 90% case and is tiny (~20 lines), so
shipping it keeps DX good — the engine works out of the box. Putting it behind a
contract means core isn't _coupled_ to it, preserving the constellation model.
The engine no-ops cleanly on the server (returns idle, `observeTarget` does
nothing), verified in `ssr.test.ts`.

---

## ADR-007 — pnpm workspaces; `tsc` for verification, `tsup` recommended for publishing

**Decision.** The monorepo is a **pnpm workspace** (`pnpm-workspace.yaml`), with
internal dependencies wired via the `workspace:^` protocol — pnpm rewrites it to
`^<version>` at publish time, so a core patch reaches users without republishing
every adapter. `pnpm -r` runs
scripts in topological order, so `pnpm -r build` compiles the core before the
adapters that depend on it — no manual sequencing. Each package compiles and
type-checks with `tsc` (which also emits `.d.ts`). For publishing to npm, switch
each package's `build` script to `tsup`.

Verified on a current toolchain: **TypeScript 7, Vitest 4, React 19, Vue 3,
Svelte 5** — all dependencies installed at latest.

**Why.** pnpm's topological `-r` and strict linking make a multi-package build
correct by construction. `tsc`-emitted ESM uses extensionless relative imports,
which bundlers (and every test here) resolve fine, but raw Node ESM does not;
`tsup` (esbuild) resolves and bundles properly and enforces size budgets in CI.
Using `tsc` now keeps the toolchain zero-friction while the API stabilizes;
swapping in `tsup` is a one-line change per package when you're ready to publish.

> Note: `.npmrc` sets `node-linker=hoisted` for maximum tool compatibility in this
> environment. Drop it to use pnpm's default isolated `node_modules` (stricter,
> catches phantom dependencies) once the shared dev-tooling is settled.

---

## ADR-008 — Adapters are thin bindings to `subscribe` / `getSnapshot`

**Context.** Three adapters now exist (React, Vue, Svelte) and must not each
re-implement engine logic. ADR-001 keeps the core lean, but "lean" applies to
_features_, not to the engine: the state machine, fetch orchestration, retry, and
cancellation stay in one place, and an adapter that re-derived any of them would
give every framework its own subtly different set of bugs.

**Decision.** Every adapter binds to exactly two engine methods — `subscribe`
(state changed) and `getSnapshot` (read current state) — and forwards the same
controls (`loadNextPage`, `retry`, `reset`) plus a sentinel binding. Nothing
framework-specific leaks into the core; nothing engine-specific is duplicated in
an adapter.

- **React** → `useSyncExternalStore(subscribe, getSnapshot, getSnapshot)`. The
  stable-snapshot guarantee (ADR-004) is exactly what this API needs.
- **Vue** → a `shallowRef` updated inside `subscribe`; teardown on
  `onScopeDispose`. `:ref="target"` is a Vue function ref.
- **Svelte** → the returned object _is_ a store: its `subscribe` calls `run` with
  the current snapshot immediately (Svelte's contract) then on every change, so
  `$scroll` yields the snapshot. `use:scroll.target` is a Svelte action.

**Consequence — sentinel binding is where adapters genuinely differ.** The three
frameworks do not agree on how often they invoke an element binding, and the
engine builds a _new_ `IntersectionObserver` per `observeTarget` call. A fresh
observer reports its initial intersection immediately, so a binding that fires
more than once will refetch on every render — ignoring `retry` limits and looping
indefinitely. React's callback ref (stable identity) and Svelte's action both run
only on mount/unmount; **Vue invokes function refs on every patch**, so the Vue
adapter tracks the observed node and no-ops on repeats. Regression test:
`observes the sentinel once, not on every re-render`.

**Why this matters.** Each adapter is ~15–40 lines and carries no logic worth
testing beyond "does it wire the framework's reactivity to the store." Adding
Solid, Qwik, Preact, or Vanilla is now mechanical — bind those same two methods
to that framework's reactivity primitive. The three shipped adapters are the
proof the contract generalizes.
