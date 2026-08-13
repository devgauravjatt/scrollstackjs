import { createInfiniteScroll, type InfiniteScroll } from '@scrollstackjs/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createDevtools, devtoolsPlugin } from '../src/index';

interface Page {
  readonly items: readonly number[];
  readonly next: number | null;
}

function makeEngine(): InfiniteScroll<Page, number> {
  return createInfiniteScroll<Page, number>({
    initialPageParam: 0,
    retry: false,
    fetchPage: ({ pageParam }) => ({
      items: [pageParam],
      next: pageParam >= 1 ? null : pageParam + 1,
    }),
    getNextPageParam: (last) => last.next,
  });
}

function shadowOf(): ShadowRoot {
  const host = document.body.firstElementChild;
  if (!host?.shadowRoot) throw new Error('devtools host not mounted');
  return host.shadowRoot;
}

function buttonLabelled(root: ParentNode, label: string): HTMLButtonElement {
  const match = [...root.querySelectorAll('button')].find((button) => button.textContent === label);
  if (!match) throw new Error(`no button labelled "${label}"`);
  return match;
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe('createDevtools', () => {
  it('renders nothing until mount()', () => {
    createDevtools(makeEngine());
    expect(document.body.children).toHaveLength(0);
  });

  it('mounts a shadow root with the badge showing and the panel collapsed', () => {
    createDevtools(makeEngine()).mount();
    const shadow = shadowOf();

    expect(shadow.querySelector('.badge')?.classList.contains('hidden')).toBe(false);
    expect(shadow.querySelector('.panel')?.classList.contains('hidden')).toBe(true);
  });

  it('opens, closes, and toggles', () => {
    const devtools = createDevtools(makeEngine());
    devtools.mount();
    const panel = shadowOf().querySelector('.panel');

    devtools.open();
    expect(panel?.classList.contains('hidden')).toBe(false);
    devtools.close();
    expect(panel?.classList.contains('hidden')).toBe(true);
    devtools.toggle();
    expect(panel?.classList.contains('hidden')).toBe(false);
  });

  it('lists the storageKey first in the state grid, above status', () => {
    const devtools = createDevtools(makeEngine(), { storageKey: 'feed' });
    devtools.mount();
    devtools.open();

    const cells = [...shadowOf().querySelectorAll('.grid > span')].map((cell) => cell.textContent);
    expect(cells.slice(0, 4)).toEqual(['storageKey', 'feed', 'status', 'idle']);
  });

  it('falls back to the default storageKey in the state grid', () => {
    const devtools = createDevtools(makeEngine());
    devtools.mount();
    devtools.open();

    const cells = [...shadowOf().querySelectorAll('.grid > span')].map((cell) => cell.textContent);
    expect(cells.slice(0, 2)).toEqual(['storageKey', 'scrollstack-devtools']);
  });

  it('shows live state, the timeline, and loaded pages', async () => {
    const engine = makeEngine();
    const devtools = createDevtools(engine);
    devtools.mount();
    devtools.open();

    await engine.loadNextPage();
    devtools.open(); // force a synchronous re-render instead of waiting on rAF
    const shadow = shadowOf();

    expect(shadow.querySelector('.grid')?.textContent).toContain('success');
    expect(shadow.querySelector('.phase')?.textContent).toBe('ready');
    expect(shadow.querySelector('ul')?.textContent).toContain('success');
    expect(shadow.querySelector('details summary')?.textContent).toContain('page 0');
  });

  it('serialises page data only when a row is expanded', async () => {
    const engine = makeEngine();
    const devtools = createDevtools(engine);
    devtools.mount();
    devtools.open();
    await engine.loadNextPage();
    devtools.open();

    const details = shadowOf().querySelector('details');
    expect(details?.querySelector('pre')).toBeNull();

    details?.setAttribute('open', '');
    details?.dispatchEvent(new Event('toggle'));
    expect(details?.querySelector('pre')?.textContent).toContain('items');
  });

  it('drives the engine from the footer controls', async () => {
    const engine = makeEngine();
    const devtools = createDevtools(engine);
    devtools.mount();
    devtools.open();

    // Reset is disabled while the engine is untouched.
    expect(buttonLabelled(shadowOf(), 'reset').disabled).toBe(true);

    buttonLabelled(shadowOf(), 'load next').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(engine.getSnapshot().pages).toHaveLength(1);

    devtools.open(); // force the synchronous re-render that rAF would have done
    const reset = buttonLabelled(shadowOf(), 'reset');
    expect(reset.disabled).toBe(false);
    reset.click();
    expect(engine.getSnapshot().pages).toHaveLength(0);
  });

  it('labels a load-more failure as data-intact', async () => {
    const engine = createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      retry: false,
      fetchPage: ({ pageParam }) => {
        if (pageParam === 1) throw new Error('page 1 exploded');
        return { items: [pageParam], next: 1 };
      },
      getNextPageParam: (last) => last.next,
    });
    const devtools = createDevtools(engine);
    devtools.mount();
    devtools.open();

    await engine.loadNextPage();
    await engine.loadNextPage();
    devtools.open();

    const notice = shadowOf().querySelector('.notice');
    expect(notice?.classList.contains('hidden')).toBe(false);
    expect(notice?.textContent).toContain('load-more failed (data intact)');
    expect(notice?.textContent).toContain('page 1 exploded');
  });

  it('removes the DOM node on unmount and stops updating', () => {
    const devtools = createDevtools(makeEngine());
    devtools.mount();
    expect(document.body.children).toHaveLength(1);

    devtools.unmount();
    expect(document.body.children).toHaveLength(0);
  });

  it('persists the open state across instances', () => {
    const first = createDevtools(makeEngine(), { storageKey: 'test-key' });
    first.mount();
    first.open();
    first.destroy();

    const second = createDevtools(makeEngine(), { storageKey: 'test-key' });
    second.mount();
    expect(shadowOf().querySelector('.panel')?.classList.contains('hidden')).toBe(false);
  });

  it('detaches the store when destroyed', async () => {
    const engine = makeEngine();
    const devtools = createDevtools(engine);
    devtools.mount();
    devtools.destroy();

    const before = devtools.store.getSnapshot();
    await engine.loadNextPage();
    expect(devtools.store.getSnapshot()).toBe(before);
    expect(document.body.children).toHaveLength(0);
  });
});

describe('devtoolsPlugin', () => {
  function pluggedEngine(options: Parameters<typeof devtoolsPlugin>[0] = {}) {
    return createInfiniteScroll<Page, number>({
      initialPageParam: 0,
      fetchPage: () => ({ items: [], next: null }),
      getNextPageParam: (last) => last.next,
      plugins: [devtoolsPlugin<Page, number>(options)],
    });
  }

  it('defers the mount out of the render phase', async () => {
    // Plugins run inside createInfiniteScroll, which React calls while rendering.
    const engine = pluggedEngine({ open: true });
    expect(document.body.children).toHaveLength(0);

    await Promise.resolve();
    expect(document.body.children).toHaveLength(1);
    engine.destroy();
  });

  it('unmounts when the engine is destroyed', async () => {
    const engine = pluggedEngine({ open: true });
    await Promise.resolve();

    engine.destroy();
    expect(document.body.children).toHaveLength(0);
  });

  it('never mounts if the engine is destroyed before the microtask runs', async () => {
    const engine = pluggedEngine();
    engine.destroy(); // synchronously, as a discarded render's cleanup would

    await Promise.resolve();
    expect(document.body.children).toHaveLength(0);
  });

  it('keeps one panel per key — a newer engine evicts the older panel', async () => {
    const first = pluggedEngine({ open: true });
    const second = pluggedEngine({ open: true });
    await Promise.resolve();

    // This is the React discarded-render case: `first` is never destroyed, but its
    // panel must not linger next to the live one.
    expect(document.body.children).toHaveLength(1);

    second.destroy();
    expect(document.body.children).toHaveLength(0);
    first.destroy();
  });

  it('shows two panels when each engine has its own storageKey', async () => {
    const a = pluggedEngine({ open: true, storageKey: 'feed-a' });
    const b = pluggedEngine({ open: true, storageKey: 'feed-b' });
    await Promise.resolve();

    expect(document.body.children).toHaveLength(2);
    a.destroy();
    b.destroy();
    expect(document.body.children).toHaveLength(0);
  });
});
