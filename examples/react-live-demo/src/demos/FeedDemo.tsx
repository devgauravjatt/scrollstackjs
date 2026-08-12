import { useInfiniteScroll } from '@scrollstackjs/react'
import * as React from 'react'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
import * as ui from '../ui'

/**
 * The baseline: a sentinel rendered while `hasNextPage` is true, plus a live view
 * of the snapshot. The page param is a *URL string* here — the API's cursor is a
 * whole link, and `getNextPageParam` just returns whatever it hands back.
 */
export function FeedDemo(): React.ReactElement {
  const {
    pages,
    ref,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    isError,
    error,
    retry,
    reset,
    ...snap
  } = useInfiniteScroll<CharacterPage, string>({
    initialPageParam: CHARACTERS_URL,
    fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal),
    getNextPageParam: (last) => last.next,
  })

  const characters = pages.flatMap((page) => page.results)

  const flags: ReadonlyArray<readonly [string, boolean]> = [
    ['isIdle', snap.isIdle],
    ['isLoading', isLoading],
    ['isSuccess', snap.isSuccess],
    ['isError', isError],
    ['isFetching', snap.isFetching],
    ['isFetchingNextPage', isFetchingNextPage],
  ]

  return (
    <div className={`${ui.card} grid lg:grid-cols-[minmax(0,1fr)_232px]`}>
      <div>
        <div className={ui.bar}>
          <span className={ui.barTitle}>
            <span className={ui.dot} /> rickandmortyapi.com — cursor pagination
          </span>
          <button type="button" className={ui.btn} onClick={() => reset()}>
            Reset
          </button>
        </div>

        <div className={ui.scrollBox}>
          {isLoading && <Skeleton />}

          {isError && (
            <div
              className="flex flex-col items-center gap-3 p-6 text-center text-[13px] text-slate-400"
              role="alert"
            >
              <p>Couldn’t reach the API — {String(error)}</p>
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
                <span>
                  <strong className="block text-[13.5px] font-medium">{character.name}</strong>
                  <span className="block text-xs text-slate-500">
                    {character.species} · {character.status}
                  </span>
                </span>
                <span className="ml-auto font-mono text-[11px] text-slate-600">
                  #{character.id}
                </span>
              </li>
            ))}
          </ul>

          {/* Sentinel: scrolling it into view loads the next page. */}
          {hasNextPage && !isError ? (
            <div ref={ref} className={ui.sentinel}>
              {isFetchingNextPage && (
                <>
                  <span className={ui.spinner} /> Loading more…
                </>
              )}
            </div>
          ) : (
            characters.length > 0 && (
              <p className="p-5 text-center text-[13px] text-slate-500">
                That’s all {characters.length} characters.
              </p>
            )
          )}
        </div>
      </div>

      <aside className="border-t border-slate-800 bg-slate-900 p-4 lg:border-t-0 lg:border-l">
        <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Live snapshot
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <Field label="status" value={snap.status} />
          <Field label="fetchStatus" value={snap.fetchStatus} />
          <Field label="pages" value={pages.length} />
          <Field label="rows" value={characters.length} />
          <Field label="hasNextPage" value={String(hasNextPage)} />
          <Field label="failureCount" value={snap.failureCount} />
        </dl>

        <p className="mt-4 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Derived
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {flags.map(([name, on]) => (
            <li
              key={name}
              className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] ${
                on ? 'border-teal-400 bg-teal-400 text-teal-950' : 'border-slate-800 text-slate-600'
              }`}
            >
              {name}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number }): React.ReactElement {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-mono text-[11.5px] text-slate-300">{value}</dd>
    </>
  )
}

function Skeleton(): React.ReactElement {
  return (
    <ul>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className={ui.row}>
          <span className="size-8 shrink-0 animate-pulse rounded-full bg-slate-800" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-2.5 w-2/5 animate-pulse rounded bg-slate-800" />
            <span className="h-2.5 w-1/4 animate-pulse rounded bg-slate-800" />
          </span>
        </li>
      ))}
    </ul>
  )
}
