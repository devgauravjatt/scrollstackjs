/**
 * The demos call real, free, no-key public APIs — one per pagination shape, which
 * is the point: cursor, offset, and page-number are all the same engine.
 *
 *   Rick and Morty   cursor      `info.next` is a full URL
 *   PokéAPI          offset      ?offset=N&limit=N
 *   JSONPlaceholder  page number ?_page=N&_limit=N
 *
 * Everything below throws on a non-2xx response — `fetch` only rejects on network
 * failure, so without an `res.ok` check the engine would happily store an error
 * page as data.
 */

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return (await response.json()) as T
}

/* ------------------------------------------------ Rick and Morty (cursor) */

export interface Character {
  readonly id: number
  readonly name: string
  readonly species: string
  readonly status: string
  readonly image: string
}

export interface CharacterPage {
  readonly results: readonly Character[]
  readonly next: string | null
}

export const CHARACTERS_URL = 'https://rickandmortyapi.com/api/character?page=1'

/** A page that genuinely 404s — the demos use it to trigger real failures. */
export const BROKEN_CHARACTERS_URL = 'https://rickandmortyapi.com/api/character?page=9999'

/** Default artificial delay, so the loading states are actually visible. */
export const DEMO_DELAY_MS = 2500

/** Waits `ms`, or rejects the moment the signal aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export async function fetchCharacters(
  url: string,
  signal: AbortSignal,
  // The tutorial playground dials this down so you can experiment quickly.
  delayMs: number = DEMO_DELAY_MS,
): Promise<CharacterPage> {
  // wait to show the loading state
  await sleep(delayMs, signal)
  const body = await getJson<{
    info: { next: string | null }
    results: Character[]
  }>(url, signal)
  return { results: body.results, next: body.info.next }
}

/* ------------------------------------------------------- PokéAPI (offset) */

export interface Pokemon {
  readonly name: string
  readonly url: string
}

export const POKEMON_LIMIT = 10

//Add delay to PokéAPI fetch function to match Rick and Morty demo's loading state duration
export async function fetchPokemon(offset: number, signal: AbortSignal): Promise<Pokemon[]> {
  // wait 2.5 seconds to show the loading state
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const body = await getJson<{ results: Pokemon[] }>(
    `https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=${POKEMON_LIMIT}`,
    signal,
  )
  return body.results
}

/** Extracts the numeric id out of a PokéAPI resource URL, for the sprite. */
export function pokemonId(url: string): number {
  return Number(url.replace(/\/$/, '').split('/').pop())
}

export function pokemonSprite(url: string): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId(url)}.png`
}

/* ------------------------------------------- JSONPlaceholder (page number) */

export interface Post {
  readonly id: number
  readonly title: string
  readonly body: string
}

export const POSTS_LIMIT = 8

export async function fetchPosts(page: number, signal: AbortSignal): Promise<readonly Post[]> {
  return getJson<Post[]>(
    `https://jsonplaceholder.typicode.com/posts?_page=${page}&_limit=${POSTS_LIMIT}`,
    signal,
  )
}
