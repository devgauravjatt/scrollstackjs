/**
 * `@scrollstackjs/devtools` — a dev-only panel for inspecting a ScrollStack engine.
 *
 * Three entry points, in order of how much you want to do yourself:
 *
 * - {@link devtoolsPlugin} — register it in `plugins` and forget about it.
 * - {@link createDevtools} — mount and control the panel yourself.
 * - {@link createDevtoolsStore} — headless; build your own UI on it.
 *
 * The package holds no engine logic (invariant 1): it reads `subscribe` /
 * `getSnapshot` / `on` and forwards the existing commands. Importing it has no
 * side effects, so a production build that never mounts it drops it entirely.
 */

import type { InfiniteScroll, ScrollStackPlugin } from '@scrollstackjs/core';

import {
  createPanel,
  DEFAULT_STORAGE_KEY,
  type DevtoolsOptions,
  type DevtoolsPanel,
} from './panel';
import { createDevtoolsStore, type DevtoolsStore } from './store';

export { createDevtoolsStore, derivePhase } from './store';
export type {
  DevtoolsEvent,
  DevtoolsEventType,
  DevtoolsPhase,
  DevtoolsState,
  DevtoolsStore,
  DevtoolsStoreOptions,
} from './store';
export { DEFAULT_STORAGE_KEY } from './panel';
export type { DevtoolsOptions, DevtoolsPanel, DevtoolsPosition, DevtoolsTheme } from './panel';

/** A devtools instance: the panel controls plus the store behind it. */
export interface Devtools<TData, TPageParam> extends DevtoolsPanel {
  /** The store feeding the panel — useful for assertions in tests. */
  readonly store: DevtoolsStore<TData, TPageParam>;
  /** Unmounts the panel and detaches the store from the engine. */
  destroy(): void;
}

/**
 * Attaches devtools to an engine. Nothing renders until {@link DevtoolsPanel.mount}.
 *
 * @example
 * ```ts
 * import { createInfiniteScroll } from '@scrollstackjs/core'
 * import { createDevtools } from '@scrollstackjs/devtools'
 *
 * const scroll = createInfiniteScroll({ ... })
 * const devtools = createDevtools(scroll)
 * if (import.meta.env.DEV) devtools.mount()
 * ```
 */
export function createDevtools<TData, TPageParam>(
  engine: InfiniteScroll<TData, TPageParam>,
  options: DevtoolsOptions = {},
): Devtools<TData, TPageParam> {
  const store = createDevtoolsStore(engine, { maxEvents: options.maxEvents });
  const panel = createPanel(store, options);

  return {
    store,
    mount: (container) => panel.mount(container),
    unmount: () => panel.unmount(),
    open: () => panel.open(),
    close: () => panel.close(),
    toggle: () => panel.toggle(),
    destroy() {
      panel.destroy();
      store.destroy();
    },
  };
}

/**
 * One panel per storage key. Mounting a newer panel evicts the older one, which is
 * what makes the plugin safe in React: the adapter builds its engine *during
 * render*, and a render React later throws away leaves an engine nobody will ever
 * destroy. Its panel would sit there forever; instead the surviving render's panel
 * replaces it.
 */
const mountedByKey = new Map<string, { destroy(): void }>();

/**
 * The same panel as a plugin, so an app wires devtools once in its options instead
 * of at every call site. Works with every adapter — the engine's `destroy()` tears
 * the panel down, and the mount is deferred out of the render phase.
 *
 * Two panels at once need two keys: pass a distinct `storageKey` per engine,
 * otherwise the second one replaces the first.
 *
 * @example
 * ```ts
 * import { createInfiniteScroll } from '@scrollstackjs/core'
 * import { devtoolsPlugin } from '@scrollstackjs/devtools'
 *
 * const scroll = createInfiniteScroll({
 *   initialPageParam: 0,
 *   fetchPage,
 *   getNextPageParam: (last) => last.nextCursor,
 *   plugins: import.meta.env.DEV ? [devtoolsPlugin()] : [],
 * })
 * ```
 */
export function devtoolsPlugin<TData, TPageParam>(
  options: DevtoolsOptions = {},
): ScrollStackPlugin<TData, TPageParam> {
  return (engine) => {
    const key = options.storageKey ?? DEFAULT_STORAGE_KEY;
    const devtools = createDevtools(engine, options);
    let disposed = false;

    // Plugins run inside `createInfiniteScroll`, which React adapters call during
    // render. Touching the DOM there is a render-phase side effect, so hand the
    // mount to a microtask — by then the framework has committed.
    queueMicrotask(() => {
      if (disposed) return;
      const previous = mountedByKey.get(key);
      if (previous !== devtools) previous?.destroy();
      mountedByKey.set(key, devtools);
      devtools.mount();
    });

    return () => {
      disposed = true;
      if (mountedByKey.get(key) === devtools) mountedByKey.delete(key);
      devtools.destroy();
    };
  };
}
