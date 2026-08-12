<script lang="ts">
  import { createInfiniteScroll } from '@scrollstackjs/svelte'
  /**
   * The child half of the horizontal pattern: it mounts *inside* the scroll
   * container and receives it as `root`, which is what makes a right-hand
   * `rootMargin` mean "before the end of the rail".
   */
  import { onDestroy, untrack } from 'svelte'

  import { CHARACTERS_URL, fetchCharacters, type CharacterPage } from '../api'
  import * as ui from '../ui'

  const { root }: { root: Element } = $props()

  const scroll = createInfiniteScroll<CharacterPage, string>({
    initialPageParam: CHARACTERS_URL,
    fetchPage: ({ pageParam, signal }) => fetchCharacters(pageParam, signal),
    getNextPageParam: (last) => last.next,
    // `untrack` is deliberate: the engine reads its options once, at creation, so
    // capturing the initial value is the intent. The parent remounts via {#key}.
    root: untrack(() => root),
    rootMargin: '0px 240px 0px 0px',
  })
  const { target } = scroll
  onDestroy(scroll.destroy)

  const characters = $derived($scroll.pages.flatMap((page) => page.results))
</script>

{#if $scroll.isLoading}
  {#each { length: 6 } as _, i (i)}
    <div class="h-[104px] w-[148px] shrink-0 animate-pulse rounded-lg bg-slate-800"></div>
  {/each}
{/if}

{#each characters as character (character.id)}
  <figure class="w-[148px] shrink-0 [scroll-snap-align:start]">
    <img
      src={character.image}
      alt={character.name}
      loading="lazy"
      class="h-[104px] w-full rounded-lg bg-slate-800 object-cover"
    />
    <figcaption class="pt-2">
      <strong class="block truncate text-[13px] font-medium">{character.name}</strong>
      <span class="block text-[11.5px] text-slate-500">{character.species}</span>
    </figcaption>
  </figure>
{/each}

<!-- A sentinel in a rail needs real width — a zero-width flex item never intersects. -->
{#if $scroll.hasNextPage}
  <div
    use:target
    class="grid h-[104px] w-[148px] shrink-0 place-items-center rounded-lg border border-dashed border-slate-700"
  >
    {#if $scroll.isFetchingNextPage}<span class={ui.spinner}></span>{/if}
  </div>
{:else if characters.length > 0}
  <div
    class="grid h-[104px] w-[148px] shrink-0 place-items-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500"
  >
    All {characters.length}
  </div>
{/if}
