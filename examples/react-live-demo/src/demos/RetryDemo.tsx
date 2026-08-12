import { useInfiniteScroll } from '@scrollstackjs/react'
import * as React from 'react'

import { BROKEN_CHARACTERS_URL, CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
import * as ui from '../ui'

/**
 * Failure handling. The toggle points the next fetch at a URL that really 404s,
 * so the engine retries twice on a short backoff (`failureCount` climbs while
 * `error` is still null) and only then gives up — with every loaded row intact.
 */
export function RetryDemo(): React.ReactElement {
  const [broken, setBroken] = React.useState(false)
  // Read through a ref: options are captured once, at mount.
  const brokenRef = React.useRef(broken)
  brokenRef.current = broken

  const {
    pages,
    ref,
    isFetchingNextPage,
    hasNextPage,
    error,
    isFetching,
    failureCount,
    status,
    retry,
    reset,
  } = useInfiniteScroll<CharacterPage, string>({
    initialPageParam: CHARACTERS_URL,
    fetchPage: ({ pageParam, signal }) =>
      fetchCharacters(brokenRef.current ? BROKEN_CHARACTERS_URL : pageParam, signal),
    getNextPageParam: (last) => last.next,
    retry: 2,
    retryDelay: (count) => 400 * count,
  })

  const characters = pages.flatMap((page) => page.results)
  // An error, data already on screen, nothing in flight.
  const loadMoreFailed = error !== null && characters.length > 0 && !isFetching
  const retrying = failureCount > 0 && error === null

  return (
    <div className={ui.card}>
      <div className={ui.bar}>
        <span className={ui.barTitle}>
          <span className="size-2 rounded-full bg-amber-400 ring-4 ring-amber-400/15" /> Errors
          &amp; retry
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400 select-none">
            <input
              type="checkbox"
              checked={broken}
              onChange={(event) => setBroken(event.target.checked)}
              className="accent-teal-500"
            />
            Break the next fetch (404)
          </label>
          <button type="button" className={ui.btn} onClick={() => reset()}>
            Reset
          </button>
        </div>
      </div>

      <div className={`${ui.scrollBox} h-60`}>
        {error !== null && characters.length === 0 && (
          <div
            className="flex flex-col items-center gap-3 p-6 text-center text-[13px] text-slate-400"
            role="alert"
          >
            <p>
              <code className={ui.code}>{String(error)}</code> — nothing to show, so{' '}
              <code className={ui.code}>isError</code> is true.
            </p>
            <button type="button" className={ui.btn} onClick={() => void retry()}>
              Try again
            </button>
          </div>
        )}

        <ul>
          {characters.map((character) => (
            <li key={character.id} className={ui.row}>
              <img
                src={character.image}
                alt={character.name}
                loading="lazy"
                className="size-8 shrink-0 rounded-full bg-slate-800 object-cover"
              />
              <span className="text-[13.5px]">{character.name}</span>
              <span className="ml-auto font-mono text-[11px] text-slate-600">#{character.id}</span>
            </li>
          ))}
        </ul>

        {hasNextPage ? (
          <div ref={ref} className={ui.sentinel}>
            {retrying && (
              <>
                <span className={ui.spinner} /> Retry {failureCount} of 2…
              </>
            )}
            {!retrying && isFetchingNextPage && (
              <>
                <span className={ui.spinner} /> Loading more…
              </>
            )}
          </div>
        ) : (
          characters.length > 0 && (
            <p className="p-5 text-center text-[13px] text-slate-500">
              That’s all {characters.length}.
            </p>
          )
        )}
      </div>

      {loadMoreFailed && (
        <div
          className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-800 bg-red-500/5 px-4 py-3 text-[13px] text-red-300"
          role="alert"
        >
          <span>
            Load-more failed — <code className={ui.code}>status</code> is still{' '}
            <code className={ui.code}>{status}</code> and your {characters.length} rows are
            untouched.
          </span>
          <button type="button" className={ui.btn} onClick={() => void retry()}>
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
