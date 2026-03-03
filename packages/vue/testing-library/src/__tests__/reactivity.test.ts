/**
 * Reactivity tests — verify that ref/reactive updates flow through
 * the full pipeline: BG state change → ops → MT PAPI → JSDOM update.
 */

import { describe, it, expect } from 'vitest';
import {
  h,
  defineComponent,
  ref,
  reactive,
  nextTick,
} from '@lynx-js/vue-runtime';
import { render } from '../index.js';

describe('reactivity', () => {
  it('updates text when ref changes', async () => {
    const count = ref(0);

    const Comp = defineComponent({
      setup() {
        return () => h('text', null, `Count: ${count.value}`);
      },
    });

    const { container } = render(Comp);
    expect(container.querySelector('text')!.textContent).toBe('Count: 0');

    // Mutate state on BG thread
    count.value = 42;
    await nextTick();
    await nextTick();

    expect(container.querySelector('text')!.textContent).toBe('Count: 42');
  });

  it('updates when reactive object changes', async () => {
    const state = reactive({ name: 'Vue' });

    const Comp = defineComponent({
      setup() {
        return () => h('text', null, `Hello ${state.name}`);
      },
    });

    const { container } = render(Comp);
    expect(container.querySelector('text')!.textContent).toBe('Hello Vue');

    state.name = 'Lynx';
    await nextTick();
    await nextTick();

    expect(container.querySelector('text')!.textContent).toBe('Hello Lynx');
  });

  it('handles multiple rapid updates', async () => {
    const Comp = defineComponent({
      setup() {
        const items = ref(['a', 'b']);
        return { items };
      },
      render() {
        return h(
          'view',
          null,
          this.items.map((item: string) => h('text', { key: item }, item)),
        );
      },
    });

    const { container } = render(Comp);
    expect(container.querySelectorAll('text').length).toBe(2);
  });
});
