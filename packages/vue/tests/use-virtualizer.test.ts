import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

import { useVirtualizer } from '../src/virtual';

/**
 * jsdom reports no layout at all, so every element would be a 0px viewport. These
 * stubs give the whole document a 300px viewport and one shared scroll offset —
 * enough for a single scroll container per test.
 */
let offset = 0;

function stubLayout(): void {
  offset = 0;
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get: () => 300,
  });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get: () => offset,
    set: (value: number) => {
      offset = value;
    },
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
}

function scrollTo(element: Element, next: number): void {
  offset = next;
  element.dispatchEvent(new Event('scroll'));
}

const Rows = defineComponent({
  props: { count: { type: Number, required: true } },
  setup(props) {
    const { state, scrollTarget, measure } = useVirtualizer({
      count: () => props.count,
      estimateSize: () => 100,
      overscan: 0,
      isScrollingDelay: 0,
    });
    return () =>
      h('div', { ref: scrollTarget, class: 'scroller' }, [
        h(
          'div',
          { class: 'spacer', style: { height: `${state.value.totalSize}px` } },
          state.value.items.map((item) =>
            h('div', { key: item.key, ref: measure, 'data-index': item.index, class: 'row' }, [
              `row ${item.index}`,
            ]),
          ),
        ),
      ]);
  },
});

beforeEach(() => {
  stubLayout();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useVirtualizer', () => {
  it('renders only the window the viewport can show', async () => {
    const wrapper = mount(Rows, { props: { count: 1000 } });

    // The container is only known once the function ref has run, so the window
    // widens from the initial viewport on the tick after mount.
    await nextTick();

    expect(wrapper.findAll('.row').map((row) => row.attributes('data-index'))).toEqual([
      '0',
      '1',
      '2',
    ]);
    expect(wrapper.get('.spacer').attributes('style')).toContain('100000px');
  });

  it('follows a reactive count', async () => {
    const wrapper = mount(Rows, { props: { count: 10 } });
    expect(wrapper.get('.spacer').attributes('style')).toContain('1000px');

    await wrapper.setProps({ count: 30 });

    expect(wrapper.get('.spacer').attributes('style')).toContain('3000px');
  });

  it('moves the window as the container scrolls', async () => {
    const wrapper = mount(Rows, { props: { count: 1000 } });

    scrollTo(wrapper.get('.scroller').element, 5000);
    await nextTick();

    expect(wrapper.findAll('.row').map((row) => row.attributes('data-index'))).toEqual([
      '50',
      '51',
      '52',
    ]);
  });

  it('tears the virtualizer down with the component', async () => {
    const wrapper = mount(Rows, { props: { count: 1000 } });
    const scroller = wrapper.get('.scroller').element;

    wrapper.unmount();

    expect(() => scrollTo(scroller, 5000)).not.toThrow();
  });
});
