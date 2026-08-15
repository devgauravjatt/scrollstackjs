import { vi } from 'vitest';

/** A `DOMRect` with only the two fields the virtualizer reads filled in. */
export function rect(width: number, height: number): DOMRect {
  return {
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

/**
 * jsdom has no layout: `clientHeight` is always 0 and `scrollTop` never sticks.
 * This stands in for a real scroll container by defining both properties, so a
 * test can scroll it and resize it the way a browser would.
 */
export interface FakeScroller {
  readonly element: HTMLElement;
  /** Moves the scroll position and fires the `scroll` event, like a user would. */
  scrollTo(offset: number): void;
  /** The current offset — including one the virtualizer set itself. */
  offset(): number;
  /** Changes the viewport size and notifies any ResizeObserver watching it. */
  resize(size: number): void;
}

export function createScroller({ viewport = 300, horizontal = false } = {}): FakeScroller {
  const element = document.createElement('div');
  let offset = 0;
  let size = viewport;

  Object.defineProperty(element, horizontal ? 'scrollLeft' : 'scrollTop', {
    configurable: true,
    get: () => offset,
    set: (value: number) => {
      offset = value;
    },
  });
  Object.defineProperty(element, horizontal ? 'clientWidth' : 'clientHeight', {
    configurable: true,
    get: () => size,
  });

  document.body.append(element);

  return {
    element,
    offset: () => offset,
    scrollTo(next) {
      offset = next;
      element.dispatchEvent(new Event('scroll'));
    },
    resize(next) {
      size = next;
      FakeResizeObserver.emit(element);
    },
  };
}

/** A controllable ResizeObserver stand-in (jsdom doesn't implement one). */
export class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: ResizeObserverCallback;
  readonly observed = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.add(element);
  }
  unobserve(element: Element): void {
    this.observed.delete(element);
  }
  disconnect(): void {
    this.observed.clear();
  }

  /** Reports a size change for `targets`, to whichever observers are watching them. */
  static emit(...targets: Element[]): void {
    for (const instance of FakeResizeObserver.instances) {
      const entries = targets
        .filter((target) => instance.observed.has(target))
        .map((target) => ({ target }) as ResizeObserverEntry);
      if (entries.length > 0) {
        instance.callback(entries, instance);
      }
    }
  }

  /** `true` when any live observer is watching `target`. */
  static watches(target: Element): boolean {
    return FakeResizeObserver.instances.some((instance) => instance.observed.has(target));
  }
}

export function installResizeObserver(): void {
  FakeResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
}

/** A row element carrying the `data-index` the virtualizer measures by. */
export function createRow(index: number, size: number, horizontal = false): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('data-index', String(index));
  setRowSize(element, size, horizontal);
  return element;
}

/** Stubs the element's measured size — jsdom would report 0 for everything. */
export function setRowSize(element: Element, size: number, horizontal = false): void {
  element.getBoundingClientRect = () => (horizontal ? rect(size, 0) : rect(0, size));
}
