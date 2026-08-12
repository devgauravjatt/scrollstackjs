import * as React from 'react'

import { LOADING_DELAY_MS } from './api'
import { CancelDemo } from './demos/CancelDemo'
import { EventsDemo } from './demos/EventsDemo'
import { FeedDemo } from './demos/FeedDemo'
import { ManualDemo } from './demos/ManualDemo'
import { PaginationDemo } from './demos/PaginationDemo'
import { RailDemo } from './demos/RailDemo'
import { RetryDemo } from './demos/RetryDemo'

/**
 * Every feature of the engine, running against free public APIs. The Vue and
 * Svelte apps next door render the same seven demos from the same core.
 */
export function App(): React.ReactElement {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <header className="mb-12">
        <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-teal-300 uppercase">
          @scrollstackjs/react
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Live demo</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Seven demos, one engine, no fake data. Fetches are slowed by{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-teal-300">
            {LOADING_DELAY_MS}ms
          </code>{' '}
          in{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-teal-300">
            src/api.ts
          </code>{' '}
          so the loading states are actually visible — set it to 0 for real speed.
        </p>
      </header>

      <div className="space-y-14">
        <Section
          title="Auto-loading feed"
          blurb="A sentinel rendered while hasNextPage is true, and the observer loading the next page when it scrolls into view. The panel is the live snapshot."
        >
          <FeedDemo />
        </Section>

        <Section
          title="Errors & retry"
          blurb="Flip the toggle and scroll: the next request 404s for real. The engine retries twice, then surfaces the error — and your loaded rows stay exactly where they were."
        >
          <RetryDemo />
        </Section>

        <Section
          title="Manual pagination"
          blurb="autoLoad: false takes the observer out of it. loadNextPage() no-ops while fetching or once exhausted, so a bare button needs no guard."
        >
          <ManualDemo />
        </Section>

        <Section
          title="Horizontal rail"
          blurb="Same engine, sideways. root is the rail element and rootMargin puts the trigger 240px before its right edge."
        >
          <RailDemo />
        </Section>

        <Section
          title="Pagination is one function"
          blurb="Three real APIs, three shapes, one interface. Only getNextPageParam differs."
        >
          <PaginationDemo />
        </Section>

        <Section
          title="Cancellation & stale results"
          blurb="Start a fetch, then reset before it lands. The signal aborts, the late result is discarded, and failureCount stays 0 — an abort is a cancellation, not a failure."
        >
          <CancelDemo />
        </Section>

        <Section
          title="Events, via a plugin"
          blurb="The log is written by a plugin — a function that receives the engine, subscribes, and returns a cleanup that runs on destroy()."
        >
          <EventsDemo />
        </Section>
      </div>

      <footer className="mt-16 border-t border-slate-800 pt-6 text-sm text-slate-500">
        Virtualization, persistence, pull-to-refresh, and bi-directional pagination are deliberately
        not built — see <code className="font-mono text-xs">DECISIONS.md</code> for why each lives
        outside the core.
      </footer>
    </main>
  )
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 mb-4 max-w-3xl text-sm text-slate-400">{blurb}</p>
      {children}
    </section>
  )
}
