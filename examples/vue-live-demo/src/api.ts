/**
 * Free, key-free public APIs — one per pagination shape, which is the whole
 * point: cursor, offset, and page-number are the same engine with a different
 * `getNextPageParam`.
 *
 *   Rick and Morty   cursor       `info.next` is a full URL
 *   PokéAPI          offset       ?offset=N&limit=N
 *   JSONPlaceholder  page number  ?_page=N&_limit=N
 */

/** Artificial — makes the loading states visible. Set to 0 for real speed. */
export const LOADING_DELAY_MS = 2500

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  // `fetch` only rejects on network failure — without this check a 404 body
  // would be stored as a perfectly good page.
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
export const BROKEN_CHARACTERS_URL = 'https://rickandmortyapi.com/api/character?page=9999'

export async function fetchCharacters(url: string, signal: AbortSignal): Promise<CharacterPage> {
  await sleep(LOADING_DELAY_MS, signal)
  const body = await getJson<{ info: { next: string | null }; results: Character[] }>(url, signal)
  return { results: body.results, next: body.info.next }
}

/* ------------------------------------------------------- PokéAPI (offset) */

export interface Pokemon {
  readonly name: string
  readonly url: string
}

export const POKEMON_LIMIT = 10

export async function fetchPokemon(offset: number, signal: AbortSignal): Promise<Pokemon[]> {
  await sleep(LOADING_DELAY_MS, signal)
  const body = await getJson<{ results: Pokemon[] }>(
    `https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=${POKEMON_LIMIT}`,
    signal,
  )
  return body.results
}

export function pokemonSprite(url: string): string {
  const id = Number(url.replace(/\/$/, '').split('/').pop())
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
}

/* ------------------------------------------- JSONPlaceholder (page number) */

export interface Post {
  readonly id: number
  readonly title: string
}

export const POSTS_LIMIT = 8

export async function fetchPosts(page: number, signal: AbortSignal): Promise<readonly Post[]> {
  await sleep(LOADING_DELAY_MS, signal)
  return getJson<Post[]>(
    `https://jsonplaceholder.typicode.com/posts?_page=${page}&_limit=${POSTS_LIMIT}`,
    signal,
  )
}
