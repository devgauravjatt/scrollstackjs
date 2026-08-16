# Next plan

Where `@scrollstackjs/virtual` goes after 0.1.2, and why.

TanStack Virtual is mature, well tested, and has years of edge cases baked in.
Shipping "we also do virtual lists" will not move anyone off it. What we can do —
and what nobody bundles today — is the pairing:

> **Infinite pagination + virtualization + chat anchoring in one lightweight
> headless library.**

That sentence decides the order of everything below. Anything that only closes a
gap with TanStack Virtual ranks under anything that makes the pairing work.

---

## Where we actually are

Being honest about this matters, because three items people list as "to build" are
already shipped, and one that sounds shipped is not.

| Capability                                    | State                                                               |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Windowed rendering, overscan, padding, gap    | **Done** — binary search, 64 tests                                  |
| Horizontal axis                               | **Done**                                                            |
| Variable row heights                          | **Done** — `measureElement` replaces the estimate, suffix re-stacks |
| Rows that change size later                   | **Done** — `ResizeObserver` per rendered row                        |
| Size change _above_ the viewport doesn't jump | **Done** — `adjustScrollOnMeasure` compensates the offset           |
| Window scrolling + `scrollMargin`             | **Done**                                                            |
| `scrollToIndex` with alignment                | **Done**                                                            |
| Paging as the window nears the end            | **Done** — `connectInfiniteScroll`                                  |
| SSR                                           | **Done** — `initialViewport` / `initialOffset`                      |
| **Prepend without jumping**                   | **Not built** — see below                                           |
| **Reverse / bottom-anchored lists**           | **Not built**                                                       |
| **Loading _older_ pages**                     | **Not built** — this is a _core_ gap, not a virtual one             |
| Sticky headers, grids, multi-column lanes     | **Not built** — and not next                                        |

So "variable-height virtualization" and "dynamic resize handling" are not the next
milestones. They are the floor we already stand on. The next milestones are the
two things chat needs.

---

## 1. Scroll anchoring — prepend without jumping

**The highest-value item, and the one closest to a real user complaint.**

### What breaks today

`setOptions({ count })` is the only way the virtualizer learns the list grew. When
the count changes it re-lays-out from index 0 and **never touches `scrollOffset`**.
Appending is fine — rows below the viewport don't move what you're looking at.
Prepending is not:

```
Before                          After loading 100 older messages
┌────────────────────┐          ┌────────────────────┐
│ Message 101        │          │ Message 1          │
│ Message 102        │          │ Message 2          │
│ Message 103  ← you │          │ Message 3          │  ← you, now
│ Message 104        │          │ Message 4          │
└────────────────────┘          └────────────────────┘
                                 Message 103 is ~4,800px further down.
                                 The user has been thrown to the top.
```

Every row's `start` grew by the total size of the 100 new rows. `scrollOffset`
stayed where it was, so the viewport now shows completely different content.

### The fix: anchor on a key, not on a count

Two shapes were considered:

**(a) Tell it what happened** — `setOptions({ count, prependedCount: 100 })` and
shift `scrollOffset` by the size of those rows. Simple, but it makes the caller
track insertion positions, and it says nothing about inserts in the middle.

**(b) Anchor by key** — before a re-layout, remember the key of the first row in
the window and its offset from the viewport top. After the re-layout, find that
key's new `start` and shift `scrollOffset` by the difference.

**Take (b).** Sizes are already cached per item key, so identity is already the
thing the virtualizer trusts across re-layouts. It handles prepends, mid-list
inserts, removals and reorders with one mechanism, and it needs nothing from the
caller beyond a stable `getItemKey` — which chat data always has.

### Shape

```ts
createVirtualizer({
  count,
  estimateSize,
  getItemKey: (index) => messages[index].id,
  // 'key'   — hold the first visible row still across re-layouts
  // 'none'  — today's behavior
  anchor: 'key',
});
```

Notes for whoever picks this up:

- The shift has to land **before the browser paints**, in the same `publish()` that
  re-lays-out — not in an effect afterwards, or the jump is visible for a frame.
- When the anchor key disappears from the list entirely, fall back to holding the
  nearest surviving key, then to `'none'`.
- `adjustScrollOnMeasure` already does the narrow version of this for a _measured
  size change above the viewport_. The two must not double-count: measurement
  compensation should be expressed in terms of the same anchor once this lands.
- Default stays `'none'` for 0.2, so nobody's list moves under them on upgrade.
  Revisit for 1.0.

### Done means

- jsdom test: prepend 100 rows, assert the first visible key is still in the window
  and at the same offset from the viewport top.
- Browser test (the Playwright loop we already use on the docs site): the same
  assertion against real layout, since jsdom cannot catch a paint-timing mistake.
- A `docs/examples` page with a "load older" button you can actually click.

---

## 2. Reverse / bottom-anchored lists (chat)

Chat is the case that makes anchoring worth having, and it needs three things the
library does not have.

### 2a. Core: load _older_ pages

**This gates everything else in this section.** The engine grows in one direction:
`getNextPageParam` appends, and `pages` only ever gets a new tail. A chat history
loads _backwards_, so core needs `getPreviousPageParam` and a `loadPreviousPage()`,
with pages prepended to the array.

This is a real engine change and deserves an ADR — it touches the state machine
(is fetching-previous a distinct flag?), the retry path, and the snapshot shape.
Do it in core first, alone, with its own tests. Do not let it ride along with the
virtual work.

### 2b. Virtual: stick to the bottom

Not the same as "start at the bottom". The behavior people expect:

- Open the list → pinned to the newest message.
- A new message arrives while you are at the bottom → stay at the bottom.
- A new message arrives while you have scrolled up to read → **do not** move; show
  a "new messages" affordance instead.
- Press it → smooth-scroll to the bottom and re-pin.

The primitives that need to exist for an app to build that:

```ts
virtualizer.isAtBottom(); // within a small threshold
virtualizer.scrollToBottom({ behavior });
createVirtualizer({ stickToBottom: true }); // re-pin on growth, only while at bottom
```

The "new messages" badge itself is app state — count what arrived since
`isAtBottom()` last went false. We expose the signal, not the badge.

### 2c. The two combine, and that is the point

Load older (2a) + anchor by key (1) + stick to bottom (2b) is a working chat
history. No other headless library ships all three. This is the differentiator —
not the virtualization itself.

---

## 3. Measurement polish

Real gaps in the part that already works:

- **Two-frame settle.** A row renders at its estimate, then measures, then
  re-stacks. On a slow list you can see one frame of the wrong height. Worth
  investigating whether a synchronous measure pass in the same commit removes it.
- **Batching.** A `ResizeObserver` batch publishes once. A render pass that calls
  `measureElement` for twenty rows publishes up to twenty times. Coalesce them.
- **Cache eviction.** Measured sizes are kept per key forever. A chat with 50,000
  messages keeps 50,000 numbers — fine — but a list that churns keys will grow
  without bound. Needs a cap or a key-set sync.

---

## 4. Adapters

The pattern is proven three ways, so these are mechanical. Each needs a main entry
_and_ a `/virtual` entry, matching what React, Vue and Svelte already ship.

**Solid first.** Its store contract is the closest fit we have not done:
`from(subscribe)` maps onto our `subscribe`/`getSnapshot` pair almost directly, and
`createSignal` handles the snapshot mirror. Expect ~40 lines per entry point.

Then, in rough order of demand: **Preact** (a native entry beats `preact/compat`),
**Qwik**, **Vanilla** (a tiny render helper so the no-framework path isn't
hand-rolled DOM in the docs), **Angular** signals.

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md#adding-a-framework-adapter) before
starting one — the sentinel gotcha that bit the Vue adapter will bite any framework
whose element bindings re-run on every render.

---

## 5. Benchmarks

Not vanity numbers. Benchmark the things our positioning claims, against TanStack
Virtual and react-virtuoso:

| Measure                        | Why                                                       |
| ------------------------------ | --------------------------------------------------------- |
| Rows in the DOM at 100k        | Table stakes; we should tie.                              |
| Frame time during a fling      | Where a snapshot-per-frame design would lose. Ours isn't. |
| Memory after 50k measured rows | Exposes the cache-eviction gap above.                     |
| Time to first row              | SSR story.                                                |
| **Prepend: does it jump?**     | The one where we intend to win outright.                  |
| **Paging + virtual together**  | The combination nobody else ships in one library.         |

Publish the harness in the repo so the numbers are reproducible and so a regression
shows up in CI.

---

## Two proposals worth deciding consciously

Both came up while planning. Both conflict with a decision already recorded in
[`DECISIONS.md`](./DECISIONS.md), so they need a real answer rather than a drift.

### "Split into `@scrollstackjs/react-virtual`, `vue-virtual`, …"

**Already solved differently, and better.** The framework bindings ship as
`/virtual` **entry points** on the existing adapters
(`@scrollstackjs/react/virtual`), with `@scrollstackjs/virtual` as an _optional_
peer dependency. An app that never imports one pays nothing — same outcome as
separate packages, three fewer packages to version, publish and document.

Recommendation: **do not split.** Revisit only if a framework binding grows enough
logic to want its own release cadence, which ADR-008 says it should not.

### "One combined entry: `createScrollStack({ pagination: 'cursor', virtual: {…} })`"

The ergonomic goal is right — wiring two stores by hand is the clumsiest part of
the current API. The shape conflicts with two decisions:

- `pagination: 'cursor'` reintroduces named strategies, which **ADR-002** removed on
  purpose. Cursor/offset/page are one function, and a preset string cannot express
  the shapes we did not anticipate.
- `virtual: {…}` as an engine option makes virtualization a _mode_, which
  **ADR-009** rejected: the engine knows pages, the virtualizer knows pixels, and
  neither can express the other.

**Middle ground:** keep both primitives exactly as they are and add a compose
helper in its own package — `@scrollstackjs/feed`, say — that owns the wiring and
nothing else:

```ts
const feed = createFeed({
  fetchPage,
  getNextPageParam: (last) => last.nextCursor,
  virtual: { estimateSize: () => 48, overscan: 5 },
});
```

One import for the common case; the primitives untouched for everyone else; no ADR
reversed. If that helper turns out to be what everybody uses, _then_ fold it in —
with an ADR that says why.

---

## Order of work

1. **Core: `getPreviousPageParam` + `loadPreviousPage()`** — with an ADR. Gates chat.
2. **Virtual: anchor by key** — the differentiator, and independently useful.
3. **Virtual: `stickToBottom`, `isAtBottom()`, `scrollToBottom()`.**
4. **A chat example** in `examples/` and on the docs site, using all three. This is
   the proof the positioning is real, so it ships _with_ the features, not after.
5. **Solid adapter** (both entry points).
6. **Measurement polish** — batching, cache eviction, the two-frame settle.
7. **Benchmark harness** and the numbers.
8. Remaining adapters, as demand shows up.

## Prerequisites before any of this is released

Carried over from `STATUS.md`, and blocking regardless of what lands:

- **`tsup` build.** `tsc` emits extensionless relative imports, so the published
  packages fail to load in raw Node ESM today. One-line change per package.
- **CI that runs the tests on pull requests.** There isn't one. Everything above
  assumes a regression gets caught by something other than a person remembering.
- **`size-limit` in CI** so the "lightweight" claim in the positioning is enforced
  rather than asserted.

## Non-goals

- Grids and multi-column lanes. Real work, no relationship to the pairing we are
  betting on. After 1.0, if asked for.
- Sticky headers. Same.
- Becoming a component library. There is still no markup in any package, and that
  stays true.
- Feature parity with TanStack Virtual as an end in itself. We are aiming at a
  different shape of problem; matching its API surface item for item would trade
  our size budget for someone else's roadmap.
