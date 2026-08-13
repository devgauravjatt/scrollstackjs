import { useInfiniteScroll, type InfiniteScrollOptions } from '@scrollstackjs/react'
import * as React from 'react'

import {
  CHARACTERS_URL,
  POKEMON_LIMIT,
  POSTS_LIMIT,
  fetchCharacters,
  fetchPokemon,
  fetchPosts,
} from '../api'
import * as ui from '../ui'

/**
 * Three real APIs, three pagination shapes, one engine. Nothing differs except
 * `getNextPageParam` — there is no strategy switch inside the engine to flip.
 */
export function PaginationDemo(): React.ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Strategy
        label="Cursor"
        source="rickandmortyapi.com"
        code="getNextPageParam: (last) => last.next"
        truncate={34}
        options={{
          initialPageParam: CHARACTERS_URL,
          fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal),
          getNextPageParam: (last) => last.next,
        }}
      />
      <Strategy
        label="Offset / limit"
        source="pokeapi.co"
        code={
          'getNextPageParam: (page, _all, param) =>\n  page.length === LIMIT ? param + LIMIT : null'
        }
        options={{
          initialPageParam: 0,
          fetchPage: ({ pageParam, signal }) => fetchPokemon(pageParam, signal),
          getNextPageParam: (page, _all, param) =>
            page.length === POKEMON_LIMIT ? param + POKEMON_LIMIT : null,
        }}
      />
      <Strategy
        label="Page number"
        source="jsonplaceholder.typicode.com"
        code={
          'getNextPageParam: (page, _all, param) =>\n  page.length === LIMIT ? param + 1 : null'
        }
        options={{
          initialPageParam: 1,
          fetchPage: ({ pageParam, signal }) => fetchPosts(pageParam, signal),
          getNextPageParam: (page, _all, param) => (page.length === POSTS_LIMIT ? param + 1 : null),
        }}
      />
    </div>
  )
}

interface StrategyProps<TData, TPageParam> {
  readonly label: string
  readonly source: string
  readonly code: string
  /** Cursor params are URLs — show only their tail. */
  readonly truncate?: number
  readonly options: InfiniteScrollOptions<TData, TPageParam>
}

function Strategy<TData, TPageParam>({
  label,
  source,
  code,
  truncate = 0,
  options,
}: StrategyProps<TData, TPageParam>): React.ReactElement {
  const { pages, pageParams, hasNextPage, isFetching, error, loadNextPage, reset } =
    useInfiniteScroll<TData, TPageParam>(options)

  // Key on the *untruncated* param: page params are unique per page, whereas two
  // long cursor URLs can share a tail once truncated for display.
  const shown = pageParams.map((param) => {
    const key = String(param)
    const text = truncate > 0 && key.length > truncate ? `…${key.slice(-truncate)}` : key
    return { key, text }
  })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold tracking-wider text-teal-300 uppercase">
        {label}
        <span className="mt-0.5 block text-[10.5px] font-normal tracking-normal text-slate-500 normal-case">
          {source}
        </span>
      </p>

      <pre className="overflow-x-auto rounded-lg bg-slate-950 p-2.5 text-[11px] leading-relaxed text-slate-400">
        <code>{code}</code>
      </pre>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500">pages</dt>
        <dd className="text-right font-mono text-[11.5px]">{pages.length}</dd>
        <dt className="text-slate-500">hasNextPage</dt>
        <dd className="text-right font-mono text-[11.5px]">{String(hasNextPage)}</dd>
      </dl>

      <ol className="min-h-18 rounded-lg bg-slate-950 p-2.5 text-[11px]">
        {shown.length === 0 && <li className="text-slate-600">no pages fetched yet</li>}
        {shown.map(({ key, text }) => (
          <li key={key} className="font-mono break-all text-slate-400">
            {text}
          </li>
        ))}
      </ol>

      {error !== null && <p className="text-[11.5px] text-red-300">{String(error)}</p>}

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          className={ui.btn}
          disabled={!hasNextPage || isFetching}
          onClick={() => void loadNextPage()}
        >
          {isFetching && <span className={ui.spinner} />}
          Next page
        </button>
        <button type="button" className={ui.btn} onClick={() => reset()}>
          Reset
        </button>
      </div>
    </div>
  )
}
