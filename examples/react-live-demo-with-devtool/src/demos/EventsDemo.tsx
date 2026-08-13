import type { ScrollStackPlugin } from '@scrollstackjs/core'
import { useInfiniteScroll } from '@scrollstackjs/react'
import * as React from 'react'

import { POSTS_LIMIT, fetchPosts, type Post } from '../api'
import * as ui from '../ui'

/**
 * Events, through a *plugin*: a function that receives the engine, subscribes to
 * its lifecycle, and returns a cleanup that runs on `destroy()`. Plugins are
 * registered at creation, so they never miss the first `loadStart`.
 */
interface LogLine {
  readonly id: number
  readonly event: string
  readonly detail: string
}

const TAG: Record<string, string> = {
  loadStart: 'bg-slate-800 text-slate-300',
  success: 'bg-teal-400/15 text-teal-300',
  error: 'bg-red-400/15 text-red-300',
  reset: 'bg-amber-400/15 text-amber-300',
}

export function EventsDemo(): React.ReactElement {
  const [log, setLog] = React.useState<readonly LogLine[]>([])
  const nextId = React.useRef(0)

  // The plugin is created once — the hook captures it at mount anyway.
  const recorder = React.useMemo<ScrollStackPlugin<readonly Post[], number>>(() => {
    const append = (event: string, detail: string): void =>
      setLog((lines) => [{ id: nextId.current++, event, detail }, ...lines].slice(0, 8))

    return (engine) => {
      const offs = [
        engine.on('loadStart', ({ pageParam }) => append('loadStart', `_page=${pageParam}`)),
        engine.on('success', ({ pageParam, pages }) =>
          append('success', `_page=${pageParam} · ${pages.length} page(s) held`),
        ),
        engine.on('error', ({ error }) => append('error', String(error))),
        engine.on('reset', () => append('reset', 'back to the initial state')),
      ]
      return () => offs.forEach((off) => off())
    }
  }, [])

  const { pages, hasNextPage, isFetching, loadNextPage, reset } = useInfiniteScroll<
    readonly Post[],
    number
  >({
    initialPageParam: 1,
    fetchPage: ({ pageParam, signal }) => fetchPosts(pageParam, signal),
    getNextPageParam: (lastPage, _all, lastParam) =>
      lastPage.length === POSTS_LIMIT ? lastParam + 1 : null,
    autoLoad: false,
    plugins: [recorder],
  })

  return (
    <div className={ui.card}>
      <div className={ui.bar}>
        <span className={ui.barTitle}>
          <span className={ui.dot} /> jsonplaceholder — events via a plugin
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={ui.btn}
            disabled={!hasNextPage || isFetching}
            onClick={() => void loadNextPage()}
          >
            {isFetching && <span className={ui.spinner} />}
            Load a page
          </button>
          <button type="button" className={ui.btn} onClick={() => reset()}>
            Reset
          </button>
        </div>
      </div>

      <ol className="min-h-44 px-4 py-2 text-xs">
        {log.length === 0 && (
          <li className="py-6 text-center text-slate-500">
            No events yet — load a page, then reset.
          </li>
        )}
        {log.map((line) => (
          <li
            key={line.id}
            className="flex items-baseline gap-3 border-b border-slate-800 py-1.5 text-slate-400"
          >
            <code
              className={`min-w-[70px] rounded px-1.5 py-0.5 text-center text-[11px] ${TAG[line.event]}`}
            >
              {line.event}
            </code>
            <span>{line.detail}</span>
          </li>
        ))}
      </ol>

      <div className={ui.footer}>
        <span>{pages.flat().length} posts loaded into state</span>
      </div>
    </div>
  )
}
