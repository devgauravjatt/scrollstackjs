import { useInfiniteScroll } from '@scrollstackjs/react'
import * as React from 'react'

import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
import * as ui from '../ui'

/**
 * Horizontal. Because options are read once, the component that calls the hook
 * has to mount *inside* the container — hence the parent/child split. `root` is
 * the rail, which is what makes a right-hand `rootMargin` mean "before the end of
 * the rail" instead of "before the edge of the window".
 */
export function RailDemo(): React.ReactElement {
  // A state setter as the ref: unlike useRef this re-renders once the node exists.
  const [track, setTrack] = React.useState<HTMLElement | null>(null)
  const [generation, setGeneration] = React.useState(0)

  return (
    <div className={ui.card}>
      <div className={ui.bar}>
        <span className={ui.barTitle}>
          <span className={ui.dot} /> Horizontal — <code className={ui.code}>root</code> is the rail
        </span>
        <button
          type="button"
          className={ui.btn}
          onClick={() => {
            track?.scrollTo({ left: 0 })
            setGeneration((n) => n + 1)
          }}
        >
          Reset
        </button>
      </div>

      <div
        ref={setTrack}
        className="flex [scroll-snap-type:x_proximity] [scrollbar-width:thin] [scrollbar-color:#334155_transparent] gap-3 overflow-x-auto overflow-y-hidden p-4"
      >
        {track !== null && <Track key={generation} root={track} />}
      </div>
    </div>
  )
}

function Track({ root }: { root: Element }): React.ReactElement {
  const { pages, ref, isLoading, isFetchingNextPage, hasNextPage } = useInfiniteScroll<
    CharacterPage,
    string
  >({
    initialPageParam: CHARACTERS_URL,
    fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal),
    getNextPageParam: (last) => last.next,
    root,
    rootMargin: '0px 240px 0px 0px',
  })

  const characters = pages.flatMap((page) => page.results)

  return (
    <>
      {isLoading &&
        Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-[104px] w-[148px] shrink-0 animate-pulse rounded-lg bg-slate-800"
          />
        ))}

      {characters.map((character) => (
        <figure key={character.id} className="w-[148px] shrink-0 [scroll-snap-align:start]">
          <img
            src={character.image}
            alt={character.name}
            loading="lazy"
            className="h-[104px] w-full rounded-lg bg-slate-800 object-cover"
          />
          <figcaption className="pt-2">
            <strong className="block truncate text-[13px] font-medium">{character.name}</strong>
            <span className="block text-[11.5px] text-slate-500">{character.species}</span>
          </figcaption>
        </figure>
      ))}

      {/* A sentinel in a rail needs real width — a zero-width flex item never intersects. */}
      {hasNextPage ? (
        <div
          ref={ref}
          className="grid h-[104px] w-[148px] shrink-0 place-items-center rounded-lg border border-dashed border-slate-700"
        >
          {isFetchingNextPage && <span className={ui.spinner} />}
        </div>
      ) : (
        characters.length > 0 && (
          <div className="grid h-[104px] w-[148px] shrink-0 place-items-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">
            All {characters.length}
          </div>
        )
      )}
    </>
  )
}
