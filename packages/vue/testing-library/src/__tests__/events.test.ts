/**
 * Event tests — verify the sign-based event pipeline:
 * Vue onTap handler → register(sign) → __AddEvent(el, bindEvent, tap, sign)
 * → JSDOM addEventListener(bindEvent:tap) → publishEvent(sign, data) → handler
 */

import { describe, it, expect } from 'vitest';
import { h, defineComponent, ref, nextTick } from '@lynx-js/vue-runtime';
import { render, fireEvent } from '../index.js';

describe('events', () => {
  it('fires bindtap handler via fireEvent.tap', async () => {
    const clicked = ref(false);

    const Comp = defineComponent({
      setup() {
        const handleTap = () => {
          clicked.value = true;
        };
        return () =>
          h('view', { bindtap: handleTap }, [
            h('text', null, clicked.value ? 'tapped' : 'not tapped'),
          ]);
      },
    });

    const { container } = render(Comp);
    expect(container.querySelector('text')!.textContent).toBe('not tapped');

    // Find the view element and fire tap
    const viewEl = container.querySelector('view')!;
    fireEvent.tap(viewEl);

    await nextTick();
    await nextTick();

    expect(container.querySelector('text')!.textContent).toBe('tapped');
  });

  it('fires onTap handler (Vue-style naming)', async () => {
    const count = ref(0);

    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            'view',
            {
              onTap: () => {
                count.value++;
              },
            },
            [h('text', null, `${count.value}`)],
          );
      },
    });

    const { container } = render(Comp);
    expect(container.querySelector('text')!.textContent).toBe('0');

    fireEvent.tap(container.querySelector('view')!);
    await nextTick();
    await nextTick();

    expect(container.querySelector('text')!.textContent).toBe('1');
  });

  it('handles handler updates on re-render', async () => {
    const results: string[] = [];
    const toggle = ref(false);

    const Comp = defineComponent({
      setup() {
        return () =>
          h('view', {
            bindtap: () => {
              results.push(toggle.value ? 'B' : 'A');
            },
          });
      },
    });

    const { container } = render(Comp);
    const viewEl = container.querySelector('view')!;

    fireEvent.tap(viewEl);
    await nextTick();
    expect(results).toEqual(['A']);

    toggle.value = true;
    await nextTick();
    await nextTick();

    fireEvent.tap(viewEl);
    await nextTick();
    expect(results).toEqual(['A', 'B']);
  });
});
