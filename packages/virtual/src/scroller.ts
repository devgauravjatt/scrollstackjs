/**
 * The scroll-container seam. Everything that differs between "an element with
 * `overflow: auto`" and "the page itself" is isolated here, so
 * {@link ./virtualizer.ts} deals in one pair of numbers — offset and viewport size —
 * and never branches on which kind of container it was handed.
 *
 * Every function is SSR-safe: without a container nothing here is called, and the
 * `ResizeObserver` path degrades to a no-op when the environment has none.
 */

import type { ScrollContainer } from './types';

/** `true` when the container is the page rather than a scrollable element. */
export function isWindow(target: ScrollContainer): target is Window {
  return typeof Window !== 'undefined' && target instanceof Window;
}

/** Current scroll offset along the axis, in pixels. */
export function readOffset(target: ScrollContainer, horizontal: boolean): number {
  if (isWindow(target)) return horizontal ? target.scrollX : target.scrollY;
  return horizontal ? target.scrollLeft : target.scrollTop;
}

/**
 * Visible size along the axis, in pixels. `clientWidth`/`clientHeight` rather than
 * a bounding rect: those exclude the scrollbar and any border, which is exactly the
 * space rows are laid out in.
 */
export function readViewport(target: ScrollContainer, horizontal: boolean): number {
  if (isWindow(target)) return horizontal ? target.innerWidth : target.innerHeight;
  return horizontal ? target.clientWidth : target.clientHeight;
}

/**
 * Scrolls the container to an absolute offset.
 *
 * Instant scrolls on an element are a plain `scrollTop` / `scrollLeft` assignment:
 * it is synchronous and universally supported, where `scrollTo` is neither in every
 * environment the tests run in. Smooth scrolls need the real method.
 */
export function applyScroll(
  target: ScrollContainer,
  offset: number,
  horizontal: boolean,
  behavior: 'auto' | 'smooth',
): void {
  const options: globalThis.ScrollToOptions = horizontal
    ? { left: offset, behavior }
    : { top: offset, behavior };

  if (isWindow(target)) {
    target.scrollTo(options);
    return;
  }

  if (behavior === 'smooth' && typeof target.scrollTo === 'function') {
    target.scrollTo(options);
    return;
  }

  if (horizontal) target.scrollLeft = offset;
  else target.scrollTop = offset;
}

/** Subscribes to scroll events. Returns the unsubscribe. */
export function listenToScroll(target: ScrollContainer, onScroll: () => void): () => void {
  target.addEventListener('scroll', onScroll, { passive: true });
  return () => target.removeEventListener('scroll', onScroll);
}

/**
 * Subscribes to viewport size changes: a `ResizeObserver` on an element, the
 * `resize` event on the window. Returns a no-op unsubscribe where neither exists.
 */
export function observeViewport(target: ScrollContainer, onResize: () => void): () => void {
  if (isWindow(target)) {
    target.addEventListener('resize', onResize);
    return () => target.removeEventListener('resize', onResize);
  }

  if (typeof ResizeObserver === 'undefined') return () => {};

  const observer = new ResizeObserver(() => onResize());
  observer.observe(target);
  return () => observer.disconnect();
}
