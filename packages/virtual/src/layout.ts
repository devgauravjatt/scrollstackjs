/**
 * Pure layout math: sizes in, geometry out. Nothing here touches the DOM or holds
 * state — {@link ./virtualizer.ts} owns measurement, listeners, and scrolling, and
 * dispatches into these functions. Same split core uses between `state.ts` and
 * `engine.ts`, for the same reason: this is the part worth testing exhaustively.
 */

import type { ItemKey, ScrollAlignment, VirtualItem } from './types';

/** Everything {@link measure} needs to lay a list out along one axis. */
export interface LayoutSpec {
  readonly count: number;
  readonly paddingStart: number;
  readonly paddingEnd: number;
  readonly gap: number;
  getKey(index: number): ItemKey;
  /** The measured size of the item when one is known, its estimate otherwise. */
  getSize(index: number, key: ItemKey): number;
}

/** The window of items to render: both bounds inclusive, `endIndex < startIndex` when empty. */
export interface LayoutRange {
  readonly startIndex: number;
  readonly endIndex: number;
}

/**
 * Lays out items `[from, count)`, reusing `previous[0, from)` untouched — the
 * returned array shares those item objects by reference.
 *
 * Items are stacked head to tail, so a size change at index `i` can only move
 * items after `i`. Recomputing just that suffix is what keeps a 100k-row list from
 * paying an O(count) pass every time one row reports its height.
 */
export function measure(
  previous: readonly VirtualItem[],
  from: number,
  spec: LayoutSpec,
): VirtualItem[] {
  const start = Math.max(0, Math.min(from, previous.length, spec.count));
  const next: VirtualItem[] = previous.slice(0, start);

  const anchor = next[start - 1];
  let cursor = anchor === undefined ? spec.paddingStart : anchor.end + spec.gap;

  for (let index = start; index < spec.count; index++) {
    const key = spec.getKey(index);
    const size = spec.getSize(index, key);
    next.push({ index, key, start: cursor, end: cursor + size, size });
    cursor += size + spec.gap;
  }

  return next;
}

/** Size of the whole list including both paddings — the size of the spacer element. */
export function totalSize(measurements: readonly VirtualItem[], spec: LayoutSpec): number {
  const last = measurements[measurements.length - 1];
  return (last === undefined ? spec.paddingStart : last.end) + spec.paddingEnd;
}

/**
 * Index of the first item whose trailing edge is past `offset` — the first item
 * still (even partly) on screen. Binary search, so a long list costs the same as a
 * short one. Returns the last index when `offset` is past the end, `0` when empty.
 */
export function findFirstVisible(measurements: readonly VirtualItem[], offset: number): number {
  let low = 0;
  let high = measurements.length - 1;
  let result = high < 0 ? 0 : high;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (measurements[mid]!.end > offset) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return result;
}

/**
 * The items to render for a given scroll position, overscan included.
 *
 * `offset` is list-relative (the caller subtracts `scrollMargin`) and may be
 * negative when the list starts below the current scroll position.
 */
export function computeRange(
  measurements: readonly VirtualItem[],
  offset: number,
  viewportSize: number,
  overscan: number,
): LayoutRange {
  if (measurements.length === 0) return { startIndex: 0, endIndex: -1 };

  const first = findFirstVisible(measurements, offset);
  const limit = offset + viewportSize;

  let last = first;
  while (last + 1 < measurements.length && measurements[last + 1]!.start < limit) last++;

  return {
    startIndex: Math.max(0, first - overscan),
    endIndex: Math.min(measurements.length - 1, last + overscan),
  };
}

/**
 * The container-relative offset that puts item `index` where `align` asks for.
 * `'auto'` returns `currentOffset` unchanged when the item is already fully visible,
 * which is what makes repeated `scrollToIndex` calls stable.
 */
export function offsetForIndex(
  measurements: readonly VirtualItem[],
  index: number,
  align: ScrollAlignment,
  currentOffset: number,
  viewportSize: number,
  scrollMargin: number,
): number {
  const item = measurements[index];
  if (item === undefined) return currentOffset;

  const start = item.start + scrollMargin;
  const end = item.end + scrollMargin;

  let resolved = align;
  if (resolved === 'auto') {
    if (start < currentOffset) resolved = 'start';
    else if (end > currentOffset + viewportSize) resolved = 'end';
    else return currentOffset;
  }

  switch (resolved) {
    case 'start':
      return start;
    case 'end':
      return end - viewportSize;
    case 'center':
      return start + item.size / 2 - viewportSize / 2;
  }
}
