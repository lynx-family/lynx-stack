/**
 * v-if / v-for tests — verify conditional and list rendering with
 * comment anchors flowing through the pipeline correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  h,
  defineComponent,
  ref,
  nextTick,
  Fragment,
  createCommentVNode,
} from '@lynx-js/vue-runtime';
import { render } from '../index.js';

describe('v-if (conditional rendering)', () => {
  it('renders content when condition is true', () => {
    const Comp = defineComponent({
      render() {
        return h('view', null, [
          h('text', null, 'always'),
          true ? h('text', null, 'conditional') : createCommentVNode('v-if'),
        ]);
      },
    });

    const { container } = render(Comp);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(2);
  });

  it('skips content when condition is false', () => {
    const Comp = defineComponent({
      render() {
        return h('view', null, [
          h('text', null, 'always'),
          false ? h('text', null, 'hidden') : createCommentVNode('v-if'),
        ]);
      },
    });

    const { container } = render(Comp);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(1);
    expect(texts[0]!.textContent).toBe('always');
  });

  it('toggles content reactively', async () => {
    const show = ref(true);

    const Comp = defineComponent({
      setup() {
        return () =>
          h('view', null, [
            show.value
              ? h('text', null, 'visible')
              : createCommentVNode('v-if'),
          ]);
      },
    });

    const { container } = render(Comp);
    expect(container.querySelectorAll('text').length).toBe(1);

    show.value = false;
    await nextTick();
    await nextTick();

    expect(container.querySelectorAll('text').length).toBe(0);

    show.value = true;
    await nextTick();
    await nextTick();

    expect(container.querySelectorAll('text').length).toBe(1);
  });
});

describe('v-for (list rendering)', () => {
  it('renders a list of items', () => {
    const Comp = defineComponent({
      render() {
        const items = ['Apple', 'Banana', 'Cherry'];
        return h(
          'view',
          null,
          items.map((item) => h('text', { key: item }, item)),
        );
      },
    });

    const { container } = render(Comp);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(3);
    expect(texts[0]!.textContent).toBe('Apple');
    expect(texts[1]!.textContent).toBe('Banana');
    expect(texts[2]!.textContent).toBe('Cherry');
  });

  it('updates list reactively', async () => {
    const items = ref(['A', 'B']);

    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            'view',
            null,
            items.value.map((item) => h('text', { key: item }, item)),
          );
      },
    });

    const { container } = render(Comp);
    expect(container.querySelectorAll('text').length).toBe(2);

    items.value = ['A', 'B', 'C'];
    await nextTick();
    await nextTick();

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(3);
    expect(texts[2]!.textContent).toBe('C');
  });

  it('handles list item removal', async () => {
    const items = ref(['X', 'Y', 'Z']);

    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            'view',
            null,
            items.value.map((item) => h('text', { key: item }, item)),
          );
      },
    });

    const { container } = render(Comp);
    expect(container.querySelectorAll('text').length).toBe(3);

    items.value = ['X', 'Z'];
    await nextTick();
    await nextTick();

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(2);
    expect(texts[0]!.textContent).toBe('X');
    expect(texts[1]!.textContent).toBe('Z');
  });

  it('renders with Fragment', () => {
    const Comp = defineComponent({
      render() {
        return h(Fragment, null, [
          h('view', null, [h('text', null, 'First')]),
          h('view', null, [h('text', null, 'Second')]),
        ]);
      },
    });

    const { container } = render(Comp);
    const views = container.querySelectorAll('view');
    // Fragment creates anchor text nodes, but views are unambiguous
    expect(views.length).toBe(2);
    expect(views[0]!.querySelector('text')!.textContent).toBe('First');
    expect(views[1]!.querySelector('text')!.textContent).toBe('Second');
  });
});
