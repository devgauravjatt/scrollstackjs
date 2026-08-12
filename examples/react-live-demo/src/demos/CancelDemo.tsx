import { useInfiniteScroll } from '@scrollstackjs/react'
import * as React from 'react'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
import * as ui from '../ui'

/**
 * Cancellation. Start a fetch, then reset before it lands: the signal aborts, the
 * late result is discarded by the generation counter, and `failureCount` stays 0
 * — an abort is a cancellation, not a failure.
 */
export function CancelDemo(): React.ReactElement {
  const [started, setStarted] = React.useState(0)
  const [aborted, setAborted] = React.useState(0)
  const [landed, setLanded] = React.useState(0)

  const { pages, status, fetchStatus, failureCount, error, isFetching, loadNextPage, reset } =
    useInfiniteScroll<CharacterPage, string>({
      initialPageParam: CHARACTERS_URL,
      fetchPage: async ({ pageParam, signal }) => {
        setStarted((n) => n + 1)
        try {
          const page = await fetchCharacters(pageParam, signal)
          setLanded((n) => n + 1)
          return page
        } catch (err) {
          if (signal.aborted) setAborted((n) => n + 1)
          throw err
        }
      },
      getNextPageParam: (last) => last.next,
      autoLoad: false,
      retry: 0,
    })

  const counters: ReadonlyArray<readonly [number, string]> = [
    [started, 'fetches started'],
    [aborted, 'signals aborted'],
    [landed, 'responses kept'],
    [pages.length, 'pages in state'],
  ]

  return (
    <div className={ui.card}>
      <div className={ui.bar}>
        <span className={ui.barTitle}>
          <span className={ui.dot} /> Cancellation &amp; stale results
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={ui.btn}
            disabled={isFetching}
            onClick={() => void loadNextPage()}
          >
            Fetch (slow)
          </button>
          <button type="button" className={ui.btn} disabled={!isFetching} onClick={() => reset()}>
            Reset mid-flight
          </button>
          <button
            type="button"
            className={ui.btn}
            onClick={() => {
              reset()
              setStarted(0)
              setAborted(0)
              setLanded(0)
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-4">
        {counters.map(([value, label]) => (
          <div key={label} className="bg-slate-900/60 px-4 py-4 text-center">
            <span className="block text-2xl font-semibold text-teal-300 tabular-nums">{value}</span>
            <span className="mt-0.5 block text-[11.5px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      <div className={ui.footer}>
        <span>
          status <code className={ui.code}>{status}</code> · fetchStatus{' '}
          <code className={ui.code}>{fetchStatus}</code> · failureCount{' '}
          <code className={ui.code}>{failureCount}</code> · error{' '}
          <code className={ui.code}>{error === null ? 'null' : String(error)}</code>
        </span>
      </div>
    </div>
  )
}
