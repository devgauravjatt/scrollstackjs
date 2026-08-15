import {
  createVirtualizer as createCore,
  type ScrollContainer,
  type ScrollToOptions,
  type Virtualizer,
  type VirtualizerOptions,
  type VirtualizerSnapshot,
} from '@scrollstackjs/virtual';
import {
  onScopeDispose,
  shallowRef,
  toValue,
  watchEffect,
  type ComponentPublicInstance,
  type MaybeRefOrGetter,
  type ShallowRef,
} from 'vue';

/** What Vue hands a function ref: a DOM node for an element, an instance for a component. */
export type VueElementRef = Element | ComponentPublicInstance | null;

/** Unwraps a component instance to its root node, so rows may be components too. */
function toElement(value: VueElementRef): Element | null {
  if (value === null) return null;
  return '$el' in value ? ((value.$el as Element | null) ?? null) : value;
}

/**
 * Options for {@link useVirtualizer}. `count` accepts a ref or a getter as well as a
 * plain number — it is the option that changes while the list is on screen, and
 * making it reactive is what saves you from re-syncing it by hand every time a page
 * lands. Everything else is read once, at setup.
 */
export interface UseVirtualizerOptions extends Omit<VirtualizerOptions, 'count'> {
  readonly count: MaybeRefOrGetter<number>;
}

/** What {@link useVirtualizer} returns. */
export interface UseVirtualizerReturn {
  /**
   * The live snapshot. In `<script setup>` read `state.value.items`; in the
   * template it auto-unwraps, so `state.items` works directly.
   */
  readonly state: ShallowRef<VirtualizerSnapshot>;
  /** A function ref for the scrolling element: `<div :ref="scrollTarget">`. */
  readonly scrollTarget: (el: VueElementRef) => void;
  /** A function ref for each rendered row: `<div :ref="measure" :data-index="item.index">`. */
  readonly measure: (el: VueElementRef) => void;
  /** Attach a scroller you already hold — `window`, typically, for a page-scrolled list. */
  readonly setScrollElement: (target: ScrollContainer | null) => void;
  /** Scrolls the item at `index` into view. */
  readonly scrollToIndex: (index: number, options?: ScrollToOptions) => void;
  /** Scrolls the container to an absolute offset. */
  readonly scrollToOffset: (offset: number, options?: Pick<ScrollToOptions, 'behavior'>) => void;
  /** Escape hatch: the underlying virtualizer. */
  readonly virtualizer: Virtualizer;
}

/**
 * Vue 3 binding for `@scrollstackjs/virtual`. The virtualizer's snapshot is mirrored
 * into a `shallowRef` — cheap, because a snapshot only changes when the rendered
 * window does. Teardown is wired to the active effect scope.
 *
 * @example
 * <script setup lang="ts">
 * import { useVirtualizer } from '@scrollstackjs/vue/virtual';
 * const props = defineProps<{ rows: Row[] }>();
 * const { state, scrollTarget, measure } = useVirtualizer({
 *   count: () => props.rows.length,
 *   estimateSize: () => 48,
 * });
 * </script>
 *
 * <template>
 *   <div :ref="scrollTarget" style="overflow: auto; height: 400px">
 *     <div :style="{ height: `${state.totalSize}px`, position: 'relative' }">
 *       <div
 *         v-for="item in state.items"
 *         :key="item.key"
 *         :ref="measure"
 *         :data-index="item.index"
 *         :style="{ position: 'absolute', top: 0, transform: `translateY(${item.start}px)` }"
 *       >
 *         {{ rows[item.index].label }}
 *       </div>
 *     </div>
 *   </div>
 * </template>
 */
export function useVirtualizer(options: UseVirtualizerOptions): UseVirtualizerReturn {
  const virtualizer = createCore({ ...options, count: toValue(options.count) });
  const state = shallowRef(virtualizer.getSnapshot());

  const unsubscribe = virtualizer.subscribe(() => {
    state.value = virtualizer.getSnapshot();
  });

  // A ref or getter for `count` tracks here; a plain number runs this once.
  watchEffect(() => {
    virtualizer.setOptions({ count: toValue(options.count) });
  });

  // Vue invokes function refs on every patch. `setScrollElement` already no-ops on
  // an unchanged target, and re-measuring a row is idempotent, so neither needs the
  // guard the sentinel ref in `useInfiniteScroll` carries.
  const scrollTarget = (el: VueElementRef): void => {
    virtualizer.setScrollElement(toElement(el));
  };

  const measure = (el: VueElementRef): void => {
    virtualizer.measureElement(toElement(el));
  };

  onScopeDispose(() => {
    unsubscribe();
    virtualizer.destroy();
  });

  return {
    state,
    scrollTarget,
    measure,
    setScrollElement: virtualizer.setScrollElement,
    scrollToIndex: virtualizer.scrollToIndex,
    scrollToOffset: virtualizer.scrollToOffset,
    virtualizer,
  };
}

export type {
  ScrollAlignment,
  ScrollContainer,
  ScrollToOptions,
  VirtualItem,
  Virtualizer,
  VirtualizerOptions,
  VirtualizerSnapshot,
} from '@scrollstackjs/virtual';
