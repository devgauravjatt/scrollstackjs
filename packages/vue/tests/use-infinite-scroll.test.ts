import { flushPromises, mount } from '@vue/test-utils';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, type ComponentPublicInstance } from 'vue';

import { useInfiniteScroll } from '../src/index';

/** IntersectionObserver stand-in for jsdom. */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  private readonly cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    MockIntersectionObserver.instances.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  enter(el: Element): void {
    this.cb(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

interface Item {
  readonly id: number;
}

const Feed = defineComponent({
  setup() {
    const { state, target, loadNextPage } = useInfiniteScroll<Item, number>({
      initialPageParam: 0,
      fetchPage: async ({ pageParam }) => ({ id: pageParam }),
      getNextPageParam: (last) => (last.id < 2 ? last.id + 1 : null),
    });
    return { state, target, loadNextPage };
  },
  render() {
    // Vue function refs may receive a component instance; narrow to Element for the sentinel.
    const setSentinel = (el: Element | ComponentPublicInstance | null): void => {
      this.target(el instanceof Element ? el : null);
    };
    return h('div', [
      h('span', { 'data-testid': 'count' }, String(this.state.pages.length)),
      h('span', { 'data-testid': 'hasNext' }, String(this.state.hasNextPage)),
      h('button', { onClick: () => this.loadNextPage() }, 'more'),
      h('div', { ref: setSentinel, 'data-testid': 'sentinel' }),
    ]);
  },
});

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useInfiniteScroll (vue)', () => {
  it('renders the idle snapshot', () => {
    const wrapper = mount(Feed);
    expect(wrapper.get('[data-testid="count"]').text()).toBe('0');
    expect(wrapper.get('[data-testid="hasNext"]').text()).toBe('true');
    wrapper.unmount();
  });

  it('loads pages reactively as the control is used', async () => {
    const wrapper = mount(Feed);
    const button = wrapper.get('button');

    await button.trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="count"]').text()).toBe('1');

    await button.trigger('click');
    await flushPromises();
    await button.trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="count"]').text()).toBe('3');
    expect(wrapper.get('[data-testid="hasNext"]').text()).toBe('false');
    wrapper.unmount();
  });

  // Regression: Vue invokes function refs on every patch. Re-observing on each
  // one builds a fresh IntersectionObserver, which reports its initial
  // intersection immediately — so a still-visible sentinel would refetch on every
  // render, ignoring `retry` limits and looping forever.
  it('observes the sentinel once, not on every re-render', async () => {
    const wrapper = mount(Feed);
    expect(MockIntersectionObserver.instances).toHaveLength(1);

    await wrapper.get('button').trigger('click');
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    wrapper.unmount();
  });

  it('auto-loads when the sentinel intersects', async () => {
    const wrapper = mount(Feed);
    const io = MockIntersectionObserver.instances[0]!;

    io.enter(wrapper.get('[data-testid="sentinel"]').element);
    await flushPromises();

    expect(wrapper.get('[data-testid="count"]').text()).toBe('1');
    wrapper.unmount();
  });
});
