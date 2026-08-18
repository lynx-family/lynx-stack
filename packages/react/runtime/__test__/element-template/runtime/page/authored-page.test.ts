import { h } from 'preact';
import { describe, expect, it, vi } from 'vitest';

import { __ElementTemplatePage } from '../../../../src/element-template/runtime/page/authored-page.js';

describe('authored ET page projection', () => {
  it('keeps typed attributes and logical children on ordinary props', () => {
    const ref = vi.fn();
    const child = h('view', {});
    const attributes = {
      id: 'page',
      ref,
    };
    const vnode = h(__ElementTemplatePage, {
      $0: child,
      attributes,
    });

    expect(vnode.ref).toBeUndefined();
    expect(vnode.props).toEqual({
      $0: child,
      attributes,
    });
  });

  it('does not promote a ref inside typed attributes to the VNode ref channel', () => {
    const ref = vi.fn();
    const vnode = h(__ElementTemplatePage, {
      attributes: { ref },
    });

    expect(vnode.ref).toBeUndefined();
    expect(vnode.props.attributes).toEqual({ ref });
  });
});
