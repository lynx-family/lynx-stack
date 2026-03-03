/**
 * Basic render tests — verify the full dual-thread pipeline:
 * Vue component → ShadowElement → ops → callLepusMethod → applyOps → PAPI → JSDOM
 */

import { describe, it, expect } from 'vitest';
import { h, defineComponent } from '@lynx-js/vue-runtime';
import { render } from '../index.js';

describe('render', () => {
  it('renders a single view element', () => {
    const Comp = defineComponent({
      render() {
        return h('view');
      },
    });

    const { container } = render(Comp);
    expect(container.querySelector('view')).not.toBeNull();
  });

  it('renders a text element with content', () => {
    const Comp = defineComponent({
      render() {
        return h('text', null, 'Hello Lynx');
      },
    });

    const { container } = render(Comp);
    const textEl = container.querySelector('text');
    expect(textEl).not.toBeNull();
    // __SetAttribute(el, 'text', value) sets textContent in PAPI
    expect(textEl!.textContent).toBe('Hello Lynx');
  });

  it('renders nested elements', () => {
    const Comp = defineComponent({
      render() {
        return h('view', null, [
          h('text', null, 'First'),
          h('text', null, 'Second'),
        ]);
      },
    });

    const { container } = render(Comp);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(2);
    expect(texts[0]!.textContent).toBe('First');
    expect(texts[1]!.textContent).toBe('Second');
  });

  it('renders a component with props', () => {
    const Child = defineComponent({
      props: {
        label: { type: String, required: true },
      },
      render() {
        return h('text', null, this.label);
      },
    });

    const Parent = defineComponent({
      render() {
        return h(Child, { label: 'prop-value' });
      },
    });

    const { container } = render(Parent);
    const textEl = container.querySelector('text');
    expect(textEl).not.toBeNull();
    expect(textEl!.textContent).toBe('prop-value');
  });

  it('cleans up between renders', () => {
    const Comp1 = defineComponent({
      render() {
        return h('text', null, 'First render');
      },
    });

    const Comp2 = defineComponent({
      render() {
        return h('text', null, 'Second render');
      },
    });

    render(Comp1);
    const { container } = render(Comp2);

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(1);
    expect(texts[0]!.textContent).toBe('Second render');
  });
});
