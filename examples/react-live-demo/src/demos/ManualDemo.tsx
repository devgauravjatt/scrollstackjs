import { useInfiniteScroll } from '@scrollstackjs/react'
import * as React from 'react'

import { POKEMON_LIMIT, fetchPokemon, pokemonSprite, type Pokemon } from '../api'
import * as ui from '../ui'

/**
 * `autoLoad: false` keeps the observer out of it entirely — the PokéAPI paginates
 * by offset and a button drives it. `loadNextPage()` no-ops while a fetch is in
 * flight or once `hasNextPage` is false, so `disabled` below is only cosmetic.
 */
export function ManualDemo(): React.ReactElement {
  const {
    pages,
    pageParams,
    isIdle,
    isError,
    error,
    isFetching,
    hasNextPage,
    loadNextPage,
    reset,
  } = useInfiniteScroll<readonly Pokemon[], number>({
    initialPageParam: 0,
    fetchPage: ({ pageParam, signal }) => fetchPokemon(pageParam, signal),
    // A short page means the end — otherwise advance by the limit.
    getNextPageParam: (lastPage, _all, lastParam) =>
      lastPage.length === POKEMON_LIMIT ? lastParam + POKEMON_LIMIT : null,
    autoLoad: false,
  })

  const pokemon = pages.flat()

  return (
    <div className={ui.card}>
      <div className={ui.bar}>
        <span className={ui.barTitle}>
          <span className={ui.dot} /> pokeapi.co — offset,{' '}
          <code className={ui.code}>autoLoad: false</code>
        </span>
        <button type="button" className={ui.btn} onClick={() => reset()}>
          Reset
        </button>
      </div>

      <div className={`${ui.scrollBox} h-60`}>
        {isIdle && (
          <p className="p-5 text-center text-[13px] text-slate-500">
            Nothing fetched yet — press the button.
          </p>
        )}

        {isError && (
          <p className="p-5 text-center text-[13px] text-red-300" role="alert">
            {String(error)}
          </p>
        )}

        <ul>
          {pokemon.map((item, index) => (
            <li key={item.name} className={ui.row}>
              <img
                src={pokemonSprite(item.url)}
                alt={item.name}
                loading="lazy"
                className="size-8 shrink-0 rounded-full bg-slate-800 object-contain [image-rendering:pixelated]"
              />
              <span>
                <strong className="block text-[13.5px] font-medium capitalize">{item.name}</strong>
                <span className="block text-xs text-slate-500">offset {index}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={ui.footer}>
        <button
          type="button"
          className={ui.btnPrimary}
          disabled={!hasNextPage || isFetching}
          onClick={() => void loadNextPage()}
        >
          {isFetching && <span className={ui.spinner} />}
          {hasNextPage ? 'Load next page' : 'No more pages'}
        </button>
        <span>
          {pages.length} page(s) · params [{pageParams.join(', ')}]
        </span>
      </div>
    </div>
  )
}
