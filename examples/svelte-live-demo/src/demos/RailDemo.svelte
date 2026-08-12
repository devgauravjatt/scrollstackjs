<script lang="ts">
  import * as ui from '../ui'
  /**
   * The parent half: it renders the scroll container and only mounts the track
   * once the element exists, because options — `root` included — are read once,
   * when `createInfiniteScroll` runs.
   */
  import RailTrack from './RailTrack.svelte'

  let track = $state<HTMLElement | null>(null)
  let generation = $state(0)

  function reset(): void {
    track?.scrollTo({ left: 0 })
    generation += 1
  }
</script>

<div class={ui.card}>
  <div class={ui.bar}>
    <span class={ui.barTitle}>
      <span class={ui.dot}></span> Horizontal — <code class={ui.code}>root</code> is the rail
    </span>
    <button type="button" class={ui.btn} onclick={reset}>Reset</button>
  </div>

  <div
    bind:this={track}
    class="flex [scroll-snap-type:x_proximity] [scrollbar-width:thin] [scrollbar-color:#334155_transparent] gap-3 overflow-x-auto overflow-y-hidden p-4"
  >
    {#if track}
      {#key generation}
        <RailTrack root={track} />
      {/key}
    {/if}
  </div>
</div>
