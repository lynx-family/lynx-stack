import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEventValue } from '../../../../src/element-template/prop-adapters/event-value.js';
import { prepareSpreadAttrSlot } from '../../../../src/element-template/prop-adapters/spread.js';

describe('ElementTemplate spread prop adapter', () => {
  beforeEach(() => {
    globalThis.__ENABLE_CAMEL_CASE_ATTRIBUTES__ = false;
  });

  it('normalizes host spread keys and emits ordinary event values', () => {
    const handleTap = vi.fn();
    const unsupportedWorkletEvent = vi.fn();
    const unsupportedFunctionProp = vi.fn();
    const ref = vi.fn();

    const prepared = prepareSpreadAttrSlot(
      -1,
      0,
      {
        className: 'primary',
        class: 'final',
        id: 'cta',
        name: 'submit',
        __self: 'debug-self',
        __source: { fileName: 'app.tsx' },
        __spread: true,
        ref,
        bindtap: handleTap,
        'main-thread:bindtap': unsupportedWorkletEvent,
        onReady: unsupportedFunctionProp,
      },
    );

    expect(prepared).toEqual({
      class: 'final',
      id: 'cta',
      name: 'submit',
      ref: '-1-0',
      bindtap: getEventValue(-1, 0, 'bindtap'),
    });
  });

  it('normalizes nullish spread class values to an empty class string', () => {
    const prepared = prepareSpreadAttrSlot(-2, 0, { className: null });

    expect(prepared).toEqual({ class: '' });
  });

  it('converts camelCase spread attribute names when enabled by the compilation macro', () => {
    globalThis.__ENABLE_CAMEL_CASE_ATTRIBUTES__ = true;
    const prepared = prepareSpreadAttrSlot(-2, 0, {
      textMaxline: 2,
      enableFontScaling: true,
      clipRadius: 4,
      bindTap: 'event',
      className: 'label',
    });

    expect(prepared).toEqual({
      'text-maxline': 2,
      'enable-font-scaling': true,
      'clip-radius': 4,
      bindTap: getEventValue(-2, 0, 'bindTap'),
      class: 'label',
    });
  });

  it('keeps camelCase spread attribute names when the compilation macro is disabled', () => {
    expect(prepareSpreadAttrSlot(-2, 0, { textMaxline: 2 })).toEqual({ textMaxline: 2 });
  });

  it('uses source order when camelCase and dash-case spread keys collide', () => {
    globalThis.__ENABLE_CAMEL_CASE_ATTRIBUTES__ = true;
    expect(prepareSpreadAttrSlot(-2, 0, {
      'text-maxline': 1,
      textMaxline: 2,
    })).toEqual({ 'text-maxline': 2 });
  });

  it('emits null for removed event props', () => {
    const prepared = prepareSpreadAttrSlot(-3, 0, {
      bindtap: null,
      catchtap: undefined,
      'capture-bindtap': false,
    });

    expect(prepared).toEqual({
      bindtap: null,
      catchtap: null,
      'capture-bindtap': null,
    });
  });

  it('emits ordinary ref markers from spread values', () => {
    const ref = vi.fn();
    const prepared = prepareSpreadAttrSlot(-4, 1, {
      id: 'cta',
      ref,
    });

    expect(prepared).toEqual({
      id: 'cta',
      ref: '-4-1',
    });
  });

  it('emits null for explicit nullish spread refs', () => {
    expect(prepareSpreadAttrSlot(-4, 1, { ref: null })).toEqual({ ref: null });
    expect(prepareSpreadAttrSlot(-4, 1, { ref: undefined })).toEqual({ ref: null });
  });

  it('uses ordinary ref validation for spread refs', () => {
    const error = 'Elements\' "ref" property should be a function, or an object created by createRef()';

    expect(() => prepareSpreadAttrSlot(-4, 1, { ref: false })).toThrowError(error);
    expect(() => prepareSpreadAttrSlot(-4, 1, { ref: {} })).toThrowError(error);
  });

  it('ignores inherited spread refs', () => {
    const spread = Object.create({ ref: vi.fn() }) as Record<string, unknown>;
    spread.id = 'cta';

    expect(prepareSpreadAttrSlot(-4, 1, spread)).toEqual({ id: 'cta' });
  });

  it('returns null for removed spread values', () => {
    expect(prepareSpreadAttrSlot(-4, 0, null)).toBeNull();
    expect(prepareSpreadAttrSlot(-4, 0, false)).toBeNull();
  });

  it('ignores non-host spread props', () => {
    const prepared = prepareSpreadAttrSlot(-5, 0, {
      'worklet:ref': vi.fn(),
      'main-thread:ref': vi.fn(),
      'main-thread:bindtap': vi.fn(),
      'main-thread:gesture': {},
      onReady: vi.fn(),
      title: 'hello',
    });

    expect(prepared).toEqual({ title: 'hello' });
  });
});
