/**
 * Additional ops coverage tests — exercises OP codes not covered by other
 * test files: SET_ID, SET_WORKLET_EVENT, SET_MT_REF, INIT_MT_REF, and
 * native <list> element creation/insertion.
 *
 * These tests go through the full dual-thread pipeline:
 * Vue component → ShadowElement → ops → applyOps → PAPI → JSDOM
 */

import { describe, it, expect } from 'vitest';
import {
  h,
  defineComponent,
  ref,
  nextTick,
  useMainThreadRef,
  ShadowElement,
} from '@lynx-js/vue-runtime';
import { render } from '../index.js';

// ---------------------------------------------------------------------------
// SET_ID
// ---------------------------------------------------------------------------

describe('SET_ID', () => {
  it('sets element id attribute', () => {
    const Comp = defineComponent({
      render() {
        return h('view', { id: 'my-view' });
      },
    });

    const { container } = render(Comp);
    const el = container.querySelector('#my-view');
    expect(el).not.toBeNull();
    expect(el!.tagName.toLowerCase()).toBe('view');
  });

  it('updates id reactively', async () => {
    const viewId = ref('first');

    const Comp = defineComponent({
      setup() {
        return () => h('view', { id: viewId.value });
      },
    });

    const { container } = render(Comp);
    expect(container.querySelector('#first')).not.toBeNull();

    viewId.value = 'second';
    await nextTick();
    await nextTick();

    expect(container.querySelector('#first')).toBeNull();
    expect(container.querySelector('#second')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Native <list> element (CREATE list + INSERT list-item + SET_PROP platform info)
// ---------------------------------------------------------------------------

describe('native list element', () => {
  it('creates a list element with list-item children', () => {
    const Comp = defineComponent({
      render() {
        return h('list', null, [
          h('list-item', { key: 'a', 'item-key': 'key-a' }, [
            h('text', null, 'Item A'),
          ]),
          h('list-item', { key: 'b', 'item-key': 'key-b' }, [
            h('text', null, 'Item B'),
          ]),
        ]);
      },
    });

    const { container } = render(Comp);
    const listEl = container.querySelector('list');
    expect(listEl).not.toBeNull();
    // Native list uses componentAtIndex callbacks rather than direct append,
    // but the list element itself should exist.
  });

  it('creates list with platform info attributes', () => {
    const Comp = defineComponent({
      render() {
        return h('list', null, [
          h('list-item', {
            key: '1',
            'item-key': 'item-1',
            'estimated-main-axis-size-px': 100,
            'reuse-identifier': 'type-a',
          }, [
            h('text', null, 'Content'),
          ]),
        ]);
      },
    });

    const { container } = render(Comp);
    // The list element should be created successfully without errors
    const listEl = container.querySelector('list');
    expect(listEl).not.toBeNull();
  });

  it('adds items to list reactively', async () => {
    const items = ref(['A']);

    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            'list',
            null,
            items.value.map((item) =>
              h('list-item', { key: item, 'item-key': item }, [
                h('text', null, item),
              ])
            ),
          );
      },
    });

    const { container } = render(Comp);
    expect(container.querySelector('list')).not.toBeNull();

    // Add more items
    items.value = ['A', 'B', 'C'];
    await nextTick();
    await nextTick();

    // List element should still exist after update
    expect(container.querySelector('list')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// INIT_MT_REF (value-only MainThreadRef)
// ---------------------------------------------------------------------------

describe('INIT_MT_REF', () => {
  it('creates a value-only MainThreadRef without errors', () => {
    const Comp = defineComponent({
      setup() {
        // useMainThreadRef pushes INIT_MT_REF op during construction
        const counter = useMainThreadRef(42);
        return () => h('text', null, `ref wvid=${counter._wvid}`);
      },
    });

    const { container } = render(Comp);
    const textEl = container.querySelector('text');
    expect(textEl).not.toBeNull();
    // The ref was created and the op was processed without error
    expect(textEl!.textContent).toMatch(/ref wvid=\d+/);
  });
});

// ---------------------------------------------------------------------------
// SET_MT_REF (element-bound MainThreadRef)
// ---------------------------------------------------------------------------

describe('SET_MT_REF', () => {
  it('binds a MainThreadRef to an element via main-thread-ref prop', () => {
    const Comp = defineComponent({
      setup() {
        const elRef = useMainThreadRef(null);
        return () =>
          h('view', { 'main-thread-ref': elRef }, [
            h('text', null, 'bound'),
          ]);
      },
    });

    const { container } = render(Comp);
    // The component renders without errors, meaning SET_MT_REF was processed
    expect(container.querySelector('view')).not.toBeNull();
    expect(container.querySelector('text')!.textContent).toBe('bound');
  });
});

// ---------------------------------------------------------------------------
// SET_WORKLET_EVENT
// ---------------------------------------------------------------------------

describe('SET_WORKLET_EVENT', () => {
  it('sets a worklet event handler via main-thread-bindtap', () => {
    const Comp = defineComponent({
      setup() {
        // Worklet event handler — in real Lynx this runs on the Main Thread.
        // The handler value is serialized as a worklet context object.
        const handler = { _wkltId: 1, _closure: {} };
        return () =>
          h('view', { 'main-thread-bindtap': handler }, [
            h('text', null, 'worklet'),
          ]);
      },
    });

    const { container } = render(Comp);
    // The component renders without errors, meaning SET_WORKLET_EVENT was processed
    expect(container.querySelector('view')).not.toBeNull();
    expect(container.querySelector('text')!.textContent).toBe('worklet');
  });
});

// ---------------------------------------------------------------------------
// Template Ref → NodesRef (vue-ref-{id} attribute + ShadowElement methods)
// ---------------------------------------------------------------------------

describe('template ref / NodesRef', () => {
  it('sets vue-ref-{id} attribute on MT elements', () => {
    const Comp = defineComponent({
      render() {
        return h('view', null, [h('text', null, 'hello')]);
      },
    });

    const { container } = render(Comp);
    // Every non-comment element should have a vue-ref-{id} attribute
    const view = container.querySelector('view');
    expect(view).not.toBeNull();
    // The view element's id is 2 (first element after page root id=1)
    expect(view!.hasAttribute('vue-ref-2')).toBe(true);
  });

  it('ShadowElement has NodesRef methods', () => {
    const el = new ShadowElement('view');
    expect(typeof el.invoke).toBe('function');
    expect(typeof el.setNativeProps).toBe('function');
    expect(typeof el.fields).toBe('function');
    expect(typeof el.path).toBe('function');
    expect(typeof el.animate).toBe('function');
    expect(typeof el.playAnimation).toBe('function');
    expect(typeof el.pauseAnimation).toBe('function');
    expect(typeof el.cancelAnimation).toBe('function');
  });

  it('ShadowElement._selector returns correct attribute selector', () => {
    const el = new ShadowElement('view', 42);
    expect(el._selector).toBe('[vue-ref-42]');
  });
});
