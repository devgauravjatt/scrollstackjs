/**
 * The rendering half of the devtools: a floating panel in a shadow root.
 *
 * Everything here is dumb — it reads {@link DevtoolsStore} and writes DOM. All
 * derivation lives in `store.ts`, so a framework-native panel can be built later
 * against the same store without moving logic (ADR-008).
 *
 * SSR safety (invariant 7): no `document` or `window` access at module scope.
 * {@link createPanel} only builds elements inside `mount()`, which no-ops when
 * there is no DOM.
 */

import type { DevtoolsEvent, DevtoolsPhase, DevtoolsStore } from './store';

/** Corner the panel docks to before it is dragged. */
export type DevtoolsPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/** Colour scheme. `'auto'` follows `prefers-color-scheme`. */
export type DevtoolsTheme = 'auto' | 'light' | 'dark';

/** Options shared by {@link createDevtools} and {@link devtoolsPlugin}. */
export interface DevtoolsOptions {
  /** Starting corner. Ignored once the panel has been dragged and the position persisted. Default `'bottom-right'`. */
  readonly position?: DevtoolsPosition;
  /** Start expanded instead of collapsed to a badge. Default `false`. */
  readonly open?: boolean;
  /** Timeline ring-buffer size. Default `100`. */
  readonly maxEvents?: number;
  /**
   * Keyboard shortcut that toggles the panel, e.g. `'ctrl+shift+0'`.
   * Pass `null` to disable. Default `'ctrl+shift+0'` — digits avoid the
   * browser's own `ctrl+shift+<letter>` bindings.
   */
  readonly shortcut?: string | null;
  /** Persist open state, position and size to `localStorage`. Default `true`. */
  readonly persist?: boolean;
  /** `localStorage` key used when `persist` is on. Default `'scrollstack-devtools'`. */
  readonly storageKey?: string;
  /** Colour scheme. Default `'auto'`. */
  readonly theme?: DevtoolsTheme;
}

/** `localStorage` key used when `persist` is on and no `storageKey` is given. */
export const DEFAULT_STORAGE_KEY = 'scrollstack-devtools';

interface PersistedLayout {
  open?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

/** The mounted panel. */
export interface DevtoolsPanel {
  /** Renders into `container` (default `document.body`). No-op without a DOM. */
  mount(container?: Element): void;
  /** Removes the DOM node. The store keeps recording; call again to re-attach. */
  unmount(): void;
  open(): void;
  close(): void;
  toggle(): void;
}

const PHASE_LABEL: Record<DevtoolsPhase, string> = {
  idle: 'idle',
  firstLoad: 'first load…',
  firstLoadFailed: 'first load failed (no data)',
  ready: 'ready',
  fetchingNext: 'fetching next page…',
  loadMoreFailed: 'load-more failed (data intact)',
  complete: 'all pages loaded',
};

const PHASE_TONE: Record<DevtoolsPhase, 'idle' | 'busy' | 'ok' | 'warn' | 'bad'> = {
  idle: 'idle',
  firstLoad: 'busy',
  firstLoadFailed: 'bad',
  ready: 'ok',
  fetchingNext: 'busy',
  loadMoreFailed: 'warn',
  complete: 'ok',
};

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

:host {
  --bg: #ffffff;
  --bg-alt: #f4f4f5;
  --fg: #18181b;
  --fg-dim: #71717a;
  --border: #e4e4e7;
  --accent: #0d9488;
  --ok: #15803d;
  --busy: #1d4ed8;
  --warn: #b45309;
  --bad: #b91c1c;
  --idle: #71717a;
}
:host([data-theme='dark']) {
  --bg: #18181b;
  --bg-alt: #27272a;
  --fg: #f4f4f5;
  --fg-dim: #a1a1aa;
  --border: #3f3f46;
  --accent: #5eead4;
  --ok: #4ade80;
  --busy: #60a5fa;
  --warn: #fbbf24;
  --bad: #f87171;
  --idle: #a1a1aa;
}

.badge {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  color: var(--fg);
  font-size: 11px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.15);
}
.badge:hover { border-color: var(--accent); }

.panel {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  width: 380px;
  height: 460px;
  min-width: 300px;
  min-height: 220px;
  resize: both;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--fg);
  font-size: 11px;
  line-height: 1.5;
  box-shadow: 0 8px 32px rgb(0 0 0 / 0.28);
}
.hidden { display: none !important; }

header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  cursor: grab;
  user-select: none;
}
header.dragging { cursor: grabbing; }
.title { font-weight: 700; letter-spacing: 0.02em; }
.spacer { flex: 1; }

/* Tones colour the dot's background and the phase label's text — scope them, or
   the label inherits the fill and turns into a solid block. */
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dot.tone-idle { background: var(--idle); }
.dot.tone-busy { background: var(--busy); }
.dot.tone-ok   { background: var(--ok); }
.dot.tone-warn { background: var(--warn); }
.dot.tone-bad  { background: var(--bad); }

.phase { font-size: 10px; color: var(--fg-dim); }
.phase.tone-warn { color: var(--warn); }
.phase.tone-bad  { color: var(--bad); }
.phase.tone-ok   { color: var(--ok); }
.phase.tone-busy { color: var(--busy); }

button {
  font: inherit;
  font-size: 10px;
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-alt);
  color: var(--fg);
  cursor: pointer;
}
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: 0.4; cursor: not-allowed; }
button.icon { padding: 2px 6px; }

.body { flex: 1; overflow-y: auto; }
section { border-bottom: 1px solid var(--border); padding: 8px 10px; }
h2 {
  margin: 0 0 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
}

.grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.k { color: var(--fg-dim); }
.v { word-break: break-all; }

.flags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.flag {
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--fg-dim);
  font-size: 10px;
}
.flag.on { border-color: var(--accent); color: var(--accent); }

.notice {
  margin-top: 6px;
  padding: 5px 7px;
  border-left: 2px solid var(--warn);
  background: var(--bg-alt);
  color: var(--warn);
}
.notice.bad { border-left-color: var(--bad); color: var(--bad); }

.filters { display: flex; gap: 6px; margin-bottom: 6px; }
input[type='search'] {
  flex: 1;
  font: inherit;
  font-size: 10px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--fg);
}

ul { margin: 0; padding: 0; list-style: none; }
.row { display: flex; gap: 8px; padding: 2px 0; border-bottom: 1px dashed var(--border); }
.row:last-child { border-bottom: none; }
.time { color: var(--fg-dim); flex: none; }
.type { flex: none; width: 62px; }
.meta { color: var(--fg-dim); margin-left: auto; flex: none; }
.type-loadStart { color: var(--busy); }
.type-success { color: var(--ok); }
.type-error { color: var(--bad); }
.type-reset { color: var(--fg-dim); }

details { border-bottom: 1px dashed var(--border); }
details:last-child { border-bottom: none; }
summary { cursor: pointer; padding: 2px 0; }
pre {
  margin: 4px 0 6px;
  padding: 6px;
  max-height: 180px;
  overflow: auto;
  background: var(--bg-alt);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

footer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
}
.empty { color: var(--fg-dim); }
`;

function readLayout(key: string): PersistedLayout {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    // Private-mode Safari throws on localStorage access; layout is not important
    // enough to fail over.
    return {};
  }
}

function writeLayout(key: string, layout: PersistedLayout): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';
  const needsCtrl = parts.includes('ctrl');
  const needsMeta = parts.includes('meta') || parts.includes('cmd');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');
  return (
    event.key.toLowerCase() === key &&
    event.ctrlKey === needsCtrl &&
    event.metaKey === needsMeta &&
    event.shiftKey === needsShift &&
    event.altKey === needsAlt
  );
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(undefined);
  } catch {
    return '[unserializable]';
  }
}

function pad(value: number, width = 2): string {
  return `${value}`.padStart(width, '0');
}

function formatTime(at: number): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(
    date.getMilliseconds(),
    3,
  )}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Builds the floating panel for a store. Nothing touches the DOM until `mount()`.
 *
 * @example
 * ```ts
 * const panel = createPanel(store, { position: 'bottom-left' })
 * panel.mount()
 * ```
 */
export function createPanel<TData, TPageParam>(
  store: DevtoolsStore<TData, TPageParam>,
  options: DevtoolsOptions = {},
): DevtoolsPanel & { destroy(): void } {
  const {
    position = 'bottom-right',
    shortcut = 'ctrl+shift+0',
    persist = true,
    storageKey = DEFAULT_STORAGE_KEY,
    theme = 'auto',
  } = options;

  const layout = persist ? readLayout(storageKey) : {};
  let isOpen = layout.open ?? options.open ?? false;
  let filterText = '';
  let errorsOnly = false;
  let frame: number | null = null;
  let mounted = false;
  let host: HTMLElement | null = null;
  let unsubscribe: (() => void) | null = null;
  let detachGlobals: Array<() => void> = [];

  // Cached nodes, assigned during mount().
  let badge: HTMLElement;
  let badgeDot: HTMLElement;
  let badgeText: HTMLElement;
  let panel: HTMLElement;
  let head: HTMLElement;
  let headDot: HTMLElement;
  let headPhase: HTMLElement;
  let stateGrid: HTMLElement;
  let flagRow: HTMLElement;
  let noticeBox: HTMLElement;
  let timelineList: HTMLElement;
  let pagesBox: HTMLElement;
  let btnNext: HTMLButtonElement;
  let btnRetry: HTMLButtonElement;
  let btnReset: HTMLButtonElement;
  let btnPause: HTMLButtonElement;
  let autoLoadPaused = false;

  function saveLayout(patch: PersistedLayout): void {
    if (!persist) return;
    writeLayout(storageKey, { ...readLayout(storageKey), ...patch });
  }

  function applyTheme(root: HTMLElement, doc: Document): void {
    if (theme !== 'auto') {
      root.dataset.theme = theme;
      return;
    }
    // jsdom has no `matchMedia`, and neither do some embedded webviews.
    const view = doc.defaultView;
    const query =
      typeof view?.matchMedia === 'function'
        ? view.matchMedia('(prefers-color-scheme: dark)')
        : null;
    const sync = (): void => {
      root.dataset.theme = query?.matches ? 'dark' : 'light';
    };
    sync();
    if (query?.addEventListener) {
      query.addEventListener('change', sync);
      detachGlobals.push(() => query.removeEventListener('change', sync));
    }
  }

  function applyCorner(node: HTMLElement): void {
    const [vertical, horizontal] = position.split('-');
    node.style.top = vertical === 'top' ? '12px' : '';
    node.style.bottom = vertical === 'bottom' ? '12px' : '';
    node.style.left = horizontal === 'left' ? '12px' : '';
    node.style.right = horizontal === 'right' ? '12px' : '';
  }

  function applyPersistedBox(node: HTMLElement): void {
    if (layout.left !== undefined && layout.top !== undefined) {
      node.style.left = `${layout.left}px`;
      node.style.top = `${layout.top}px`;
      node.style.right = '';
      node.style.bottom = '';
    }
    if (layout.width !== undefined) node.style.width = `${layout.width}px`;
    if (layout.height !== undefined) node.style.height = `${layout.height}px`;
  }

  function makeDraggable(handle: HTMLElement, target: HTMLElement): void {
    let originX = 0;
    let originY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMove = (event: PointerEvent): void => {
      target.style.left = `${startLeft + event.clientX - originX}px`;
      target.style.top = `${startTop + event.clientY - originY}px`;
    };

    const onUp = (): void => {
      handle.classList.remove('dragging');
      handle.ownerDocument.removeEventListener('pointermove', onMove);
      handle.ownerDocument.removeEventListener('pointerup', onUp);
      saveLayout({
        left: Number.parseFloat(target.style.left) || 0,
        top: Number.parseFloat(target.style.top) || 0,
      });
    };

    const onDown = (event: PointerEvent): void => {
      if ((event.target as Element | null)?.closest('button')) return;
      const box = target.getBoundingClientRect();
      originX = event.clientX;
      originY = event.clientY;
      startLeft = box.left;
      startTop = box.top;
      target.style.left = `${box.left}px`;
      target.style.top = `${box.top}px`;
      target.style.right = '';
      target.style.bottom = '';
      handle.classList.add('dragging');
      handle.ownerDocument.addEventListener('pointermove', onMove);
      handle.ownerDocument.addEventListener('pointerup', onUp);
    };

    handle.addEventListener('pointerdown', onDown);
    detachGlobals.push(() => handle.removeEventListener('pointerdown', onDown));
  }

  function buildDom(doc: Document): HTMLElement {
    const root = doc.createElement('div');
    const shadow = root.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = STYLES;
    shadow.append(style);

    // --- badge -------------------------------------------------------------
    badge = el(doc, 'button', 'badge');
    badgeDot = el(doc, 'span', 'dot tone-idle');
    badgeText = el(doc, 'span', undefined, 'ScrollStack');
    badge.append(badgeDot, badgeText);
    badge.addEventListener('click', () => toggle());
    applyCorner(badge);

    // --- panel shell -------------------------------------------------------
    panel = el(doc, 'div', 'panel');
    applyCorner(panel);
    applyPersistedBox(panel);

    head = el(doc, 'header');
    headDot = el(doc, 'span', 'dot tone-idle');
    const title = el(doc, 'span', 'title', 'ScrollStack');
    headPhase = el(doc, 'span', 'phase', 'idle');
    const spacer = el(doc, 'span', 'spacer');
    const copyBtn = el(doc, 'button', 'icon', 'copy');
    copyBtn.title = 'Copy the current snapshot as JSON';
    copyBtn.addEventListener('click', () => {
      void doc.defaultView?.navigator?.clipboard?.writeText(
        stringify(store.getSnapshot().snapshot),
      );
    });
    const closeBtn = el(doc, 'button', 'icon', '✕');
    closeBtn.title = 'Collapse';
    closeBtn.addEventListener('click', () => close());
    head.append(headDot, title, headPhase, spacer, copyBtn, closeBtn);

    const body = el(doc, 'div', 'body');

    // --- 1. state inspector + 5. load-more indicator ------------------------
    const stateSection = el(doc, 'section');
    stateSection.append(el(doc, 'h2', undefined, 'State'));
    stateGrid = el(doc, 'div', 'grid');
    flagRow = el(doc, 'div', 'flags');
    noticeBox = el(doc, 'div', 'notice hidden');
    stateSection.append(stateGrid, flagRow, noticeBox);

    // --- 2. timeline --------------------------------------------------------
    const timelineSection = el(doc, 'section');
    timelineSection.append(el(doc, 'h2', undefined, 'Timeline'));
    const filters = el(doc, 'div', 'filters');
    const search = doc.createElement('input');
    search.type = 'search';
    search.placeholder = 'filter…';
    search.addEventListener('input', () => {
      filterText = search.value.trim().toLowerCase();
      schedule();
    });
    const errorsBtn = el(doc, 'button', undefined, 'errors only');
    errorsBtn.addEventListener('click', () => {
      errorsOnly = !errorsOnly;
      errorsBtn.style.borderColor = errorsOnly ? 'var(--accent)' : '';
      schedule();
    });
    const clearBtn = el(doc, 'button', undefined, 'clear');
    clearBtn.addEventListener('click', () => store.clearEvents());
    filters.append(search, errorsBtn, clearBtn);
    timelineList = el(doc, 'ul');
    timelineSection.append(filters, timelineList);

    // --- 3. page explorer ---------------------------------------------------
    const pagesSection = el(doc, 'section');
    pagesSection.append(el(doc, 'h2', undefined, 'Pages'));
    pagesBox = el(doc, 'div');
    pagesSection.append(pagesBox);

    body.append(stateSection, timelineSection, pagesSection);

    // --- 4. manual controls -------------------------------------------------
    const foot = el(doc, 'footer');
    btnNext = el(doc, 'button', undefined, 'load next');
    btnNext.addEventListener('click', () => void store.engine.loadNextPage());
    btnRetry = el(doc, 'button', undefined, 'retry');
    btnRetry.addEventListener('click', () => void store.engine.retry());
    btnReset = el(doc, 'button', undefined, 'reset');
    btnReset.addEventListener('click', () => store.engine.reset());
    btnPause = el(doc, 'button', undefined, 'pause auto-load');
    btnPause.title = 'Detach the sentinel observer so pages only load on demand';
    btnPause.addEventListener('click', () => {
      autoLoadPaused = !autoLoadPaused;
      if (autoLoadPaused) store.engine.destroyObserver();
      btnPause.textContent = autoLoadPaused ? 'auto-load paused' : 'pause auto-load';
      btnPause.style.borderColor = autoLoadPaused ? 'var(--warn)' : '';
      schedule();
    });
    foot.append(btnNext, btnRetry, btnReset, btnPause);

    panel.append(head, body, foot);
    shadow.append(badge, panel);

    makeDraggable(head, panel);

    const onPointerUp = (): void => {
      if (!isOpen) return;
      saveLayout({ width: panel.offsetWidth, height: panel.offsetHeight });
    };
    doc.addEventListener('pointerup', onPointerUp);
    detachGlobals.push(() => doc.removeEventListener('pointerup', onPointerUp));

    if (shortcut !== null && shortcut !== '') {
      const onKey = (event: KeyboardEvent): void => {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          toggle();
        }
      };
      doc.addEventListener('keydown', onKey);
      detachGlobals.push(() => doc.removeEventListener('keydown', onKey));
    }

    applyTheme(root, doc);
    return root;
  }

  function renderState(): void {
    const { snapshot, phase } = store.getSnapshot();
    const tone = PHASE_TONE[phase];

    headDot.className = `dot tone-${tone}`;
    badgeDot.className = `dot tone-${tone}`;
    headPhase.className = `phase tone-${tone}`;
    headPhase.textContent = PHASE_LABEL[phase];
    badgeText.textContent = `ScrollStack · ${snapshot.pages.length}p`;

    const rows: Array<[string, string]> = [
      // First row, above the engine's own fields: which panel am I looking at?
      ['storageKey', storageKey],
      ['status', snapshot.status],
      ['fetchStatus', snapshot.fetchStatus],
      ['pages', `${snapshot.pages.length}`],
      ['pageParams', stringify(snapshot.pageParams)],
      ['hasNextPage', `${snapshot.hasNextPage}`],
      ['failureCount', `${snapshot.failureCount}`],
    ];
    stateGrid.replaceChildren();
    const doc = stateGrid.ownerDocument;
    for (const [key, value] of rows) {
      stateGrid.append(el(doc, 'span', 'k', key), el(doc, 'span', 'v', value));
    }

    const flags: Array<[string, boolean]> = [
      ['isIdle', snapshot.isIdle],
      ['isLoading', snapshot.isLoading],
      ['isSuccess', snapshot.isSuccess],
      ['isError', snapshot.isError],
      ['isFetching', snapshot.isFetching],
      ['isFetchingNextPage', snapshot.isFetchingNextPage],
    ];
    flagRow.replaceChildren();
    for (const [name, on] of flags) {
      flagRow.append(el(doc, 'span', on ? 'flag on' : 'flag', name));
    }

    // Tool 5: name the ADR-003 case explicitly instead of leaving it to be
    // misread as "success but broken".
    if (phase === 'loadMoreFailed' || phase === 'firstLoadFailed') {
      noticeBox.className = phase === 'firstLoadFailed' ? 'notice bad' : 'notice';
      noticeBox.textContent = `${PHASE_LABEL[phase]} — ${
        snapshot.error === null ? 'no error' : describeErrorText(snapshot.error)
      }`;
    } else {
      noticeBox.className = 'notice hidden';
      noticeBox.textContent = '';
    }

    btnNext.disabled = !snapshot.hasNextPage || snapshot.isFetching;
    btnRetry.disabled = snapshot.error === null || snapshot.isFetching;
    btnReset.disabled = snapshot.isIdle;
  }

  function describeErrorText(error: unknown): string {
    if (error instanceof Error) return error.message || error.name;
    if (typeof error === 'string') return error;
    return stringify(error);
  }

  function renderTimeline(): void {
    const doc = timelineList.ownerDocument;
    const { events } = store.getSnapshot();
    const visible = events.filter((event) => {
      if (errorsOnly && event.type !== 'error') return false;
      if (filterText === '') return true;
      return rowText(event).toLowerCase().includes(filterText);
    });

    timelineList.replaceChildren();
    if (visible.length === 0) {
      timelineList.append(el(doc, 'li', 'empty', 'no events'));
      return;
    }
    for (const event of visible) {
      const li = el(doc, 'li', 'row');
      li.append(
        el(doc, 'span', 'time', formatTime(event.at)),
        el(doc, 'span', `type type-${event.type}`, event.type),
        el(doc, 'span', 'v', rowDetail(event)),
        el(doc, 'span', 'meta', event.durationMs === null ? '' : `${event.durationMs}ms`),
      );
      timelineList.append(li);
    }
  }

  function rowDetail<T>(event: DevtoolsEvent<T>): string {
    switch (event.type) {
      case 'loadStart':
        return `param ${stringify(event.pageParam)}`;
      case 'success':
        return `param ${stringify(event.pageParam)} → ${event.pageCount ?? 0} pages`;
      case 'error':
        return `param ${stringify(event.pageParam)} · ${event.message ?? ''} (fail #${
          event.failureCount ?? 0
        })`;
      default:
        return 'engine reset';
    }
  }

  function rowText<T>(event: DevtoolsEvent<T>): string {
    return `${event.type} ${rowDetail(event)}`;
  }

  function renderPages(): void {
    const doc = pagesBox.ownerDocument;
    const { snapshot } = store.getSnapshot();
    pagesBox.replaceChildren();
    if (snapshot.pages.length === 0) {
      pagesBox.append(el(doc, 'div', 'empty', 'no pages loaded'));
      return;
    }
    snapshot.pages.forEach((page, index) => {
      const details = doc.createElement('details');
      const summary = doc.createElement('summary');
      summary.textContent = `page ${index} · param ${stringify(snapshot.pageParams[index])}`;
      details.append(summary);
      // Lazily serialise: a big page turned into JSON on every render is the one
      // thing that would make this panel feel slow.
      details.addEventListener('toggle', () => {
        if (!details.open || details.querySelector('pre')) return;
        const pre = el(doc, 'pre', undefined, stringify(page));
        details.append(pre);
      });
      pagesBox.append(details);
    });
  }

  function render(): void {
    if (!mounted || !isOpen) {
      if (mounted) {
        // Keep the badge live even while collapsed — the whole point of the dot
        // is seeing state without opening the panel.
        const { phase, snapshot } = store.getSnapshot();
        badgeDot.className = `dot tone-${PHASE_TONE[phase]}`;
        badgeText.textContent = `ScrollStack · ${snapshot.pages.length}p`;
      }
      return;
    }
    renderState();
    renderTimeline();
    renderPages();
  }

  function schedule(): void {
    if (!mounted || frame !== null) return;
    const view = host?.ownerDocument.defaultView;
    const raf = view?.requestAnimationFrame?.bind(view);
    if (!raf) {
      render();
      return;
    }
    frame = raf(() => {
      frame = null;
      render();
    });
  }

  function syncVisibility(): void {
    if (!mounted) return;
    badge.classList.toggle('hidden', isOpen);
    panel.classList.toggle('hidden', !isOpen);
    render();
  }

  function open(): void {
    isOpen = true;
    saveLayout({ open: true });
    syncVisibility();
  }

  function close(): void {
    isOpen = false;
    saveLayout({ open: false });
    syncVisibility();
  }

  function toggle(): void {
    if (isOpen) close();
    else open();
  }

  return {
    mount(container?: Element) {
      if (mounted) return;
      const target = container ?? globalThis.document?.body;
      if (!target) return; // no DOM — SSR or a node test
      host = buildDom(target.ownerDocument);
      target.append(host);
      mounted = true;
      unsubscribe = store.subscribe(schedule);
      syncVisibility();
    },
    unmount() {
      if (!mounted) return;
      mounted = false;
      unsubscribe?.();
      unsubscribe = null;
      if (frame !== null) {
        host?.ownerDocument.defaultView?.cancelAnimationFrame?.(frame);
        frame = null;
      }
      for (const detach of detachGlobals) detach();
      detachGlobals = [];
      host?.remove();
      host = null;
    },
    open,
    close,
    toggle,
    destroy() {
      this.unmount();
    },
  };
}
