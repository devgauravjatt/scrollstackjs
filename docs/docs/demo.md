# Live demo

Every widget on this page is a real engine talking to a real, free, key-free
public API. The docs site is a Vue app, so the demos run on
**`@scrollstackjs/vue`** — the React and Svelte adapters expose the same snapshot
and the same controls.

No code here on purpose: play with the behavior first, then follow the link under
each demo to the part of the [tutorial](/tutorial) that explains it, in all three
frameworks.

Offline or rate-limited, you'll see the error states instead — which is itself
one of the demos.

## Auto-loading feed

The default arrangement: a sentinel rendered while `hasNextPage` is true, and the
observer loading the next page when it scrolls into view. The page param here is
a **URL string**, not a number — `getNextPageParam` returns whatever the API
hands back. The panel on the right is the live snapshot; watch `fetchStatus` flip
to `fetching` and `isFetchingNextPage` light up as you scroll.

<FeedDemo />

> **How it works →** [Tutorial § 2, Your first feed](/tutorial#_2-your-first-feed)
> — the three required options, in Vue, React, and Svelte.

## Errors, retry, and why your list survives

Flip **Break the next fetch** and scroll — the next request goes to
`?page=9999`, which really does 404. The engine retries twice on a short backoff
(`failureCount` climbs while `error` is still `null`) and only then gives up.
Notice what doesn't happen: the rows already loaded stay exactly where they were,
and `status` remains `success`.

<RetryDemo />

Uncheck the toggle, then press **Retry** — `retry()` clears `failureCount` and
`error` and resumes from the page that failed. Nothing already loaded is refetched.

> **How it works →** [Tutorial § 3, The five states you actually render](/tutorial#_3-the-five-states-you-actually-render)
> for the `loadMoreFailed` check, and [§ 5, Retry settings](/tutorial#_5-every-setting-live)
> for `retry` and `retryDelay`.

## Manual controls

Both ways into the same engine, over the PokéAPI's offset pagination.
`autoLoad` is on, so scrolling to the sentinel loads the next ten — and the
button calls `loadNextPage()` directly for the same result.

They can't race each other: `loadNextPage()` no-ops while a fetch is in flight
or once `hasNextPage` is false, so neither path needs a guard and the `disabled`
binding is purely cosmetic. Set `autoLoad: false` to make the button the only
way in.

<ManualDemo />

> **How it works →** [Tutorial § 6, Driving it yourself](/tutorial#_6-driving-it-yourself)
> for every control, or [§ 5, Observer settings](/tutorial#_5-every-setting-live)
> to toggle `autoLoad` live.

## Horizontal rail

Same engine, sideways. `root` is the rail element and `rootMargin` puts the
trigger 240px before its right edge, so a page is already in flight before you
reach the end.

<RailDemo />

Because options are read once, the component that calls the composable has to
mount _inside_ the container — hence the parent/child split.

> **How it works →** [Horizontal & scoped scrolling](/guide/horizontal) for the
> full pattern, or [Tutorial § 5, Observer settings](/tutorial#_5-every-setting-live)
> to change `root`, `rootMargin`, and `threshold` live.

## Pagination is one function

Three engines, three _different real APIs_, one interface. Only
`getNextPageParam` differs — press **Next page** on each and watch the params
accumulate.

<PaginationDemo />

The cursor column collects URLs, the offset column counts `0, 10, 20…`, and the
page column counts `1, 2, 3…`. Note that `0` is a perfectly valid param — the
engine checks `== null`, never truthiness, so an offset of zero is a real page
rather than the end of the list.

> **How it works →** [Tutorial § 4, Pick your pagination](/tutorial#_4-pick-your-pagination),
> or [Pagination](/guide/pagination) for the full guide.

## Cancellation and stale results

This one hits the API for real, then holds the result for 2.5 seconds so you can
catch it mid-flight. Start a fetch, then hit **Reset mid-flight**: the signal
aborts, the late response is discarded by the generation counter, and
`failureCount` stays at `0` — an abort is a cancellation, not a failure.

<CancelDemo />

Forwarding `signal` is the whole contract. Even if you ignore it, the generation
guard still makes the stale result inert — the signal just saves the bandwidth.

> **How it works →** [Tutorial § 2, Your first feed](/tutorial#_2-your-first-feed)
> covers the `signal` contract.

## Events, via a plugin

The log below isn't wired with `engine.on` in the component — it's a **plugin**,
a function that receives the engine, subscribes, and returns a cleanup that runs
on `destroy()`. Plugins are registered at creation, so they never miss the first
`loadStart`.

<EventsDemo />

> **How it works →** [Tutorial § 7, Watching what happens](/tutorial#_7-watching-what-happens)
> — callbacks, events, and plugins, and when to reach for each.

## Devtools, on a real engine

The panel below is the actual [`@scrollstackjs/devtools`](/api/devtools) build
reading the engine next to it — not a screenshot, and not a reimplementation for
the docs.

Press **Open devtools**, then load a page and watch the timeline record
`loadStart` → `success` with the duration of each fetch. Tick **Break the next
fetch** to see an `error` row and the load-more indicator, which distinguishes
_"first load failed (no data)"_ from _"load-more failed (data intact)"_. The
**Pages** tab shows each loaded page against the `pageParam` that fetched it.

<DevtoolsDemo />

The panel is `position: fixed`, exactly as in your own app, so it floats over
this page rather than sitting in the box — drag its header to move it, or press
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd> to toggle it. It closes when you
navigate away.

> **How it works →** [`@scrollstackjs/devtools`](/api/devtools) for the full API,
> or [Events & plugins](/guide/events-and-plugins#devtools-is-a-plugin) for the
> one-line `devtoolsPlugin()` form used in real apps.

## What isn't here

Nothing on this page is faked. Virtualization has its own package — see the
[virtual list example](/examples/virtual). Persistence, pull-to-refresh and
backwards (`getPreviousPageParam`) paging are **not built yet**.

Ready to write some? The [examples](/examples/) have the code for everything on
this page, or start at [the tutorial](/tutorial).
