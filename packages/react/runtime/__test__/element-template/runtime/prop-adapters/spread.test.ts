import { afterEach, describe, expect, it, rs } from '@rstest/core';

import { getEventValue } from '../../../../src/element-template/prop-adapters/event-value.js';
import { prepareSpreadAttrSlot } from '../../../../src/element-template/prop-adapters/spread.js';

afterEach(() => {
  lynx.__runtime_configs__ = { transformBuiltinAttributeNames: false };
});

describe('ElementTemplate spread prop adapter', () => {
  it('transforms builtin attribute names and preserves event handler lookup keys', () => {
    lynx.__runtime_configs__ = { transformBuiltinAttributeNames: true };

    const prepared = prepareSpreadAttrSlot(-1, 0, {
      textMaxline: 2,
      tailColorConvert: false,
      onClick: rs.fn(),
      onCatchTap: rs.fn(),
      onReady: null,
      bindchange: rs.fn(),
    });

    expect(prepared).toEqual({
      'text-maxline': 2,
      'tail-color-convert': false,
      bindtap: getEventValue(-1, 0, 'onClick'),
      catchtap: getEventValue(-1, 0, 'onCatchTap'),
      bindready: null,
      bindchange: getEventValue(-1, 0, 'bindchange'),
    });
  });

  it('transforms only after identifying special spread attributes', () => {
    lynx.__runtime_configs__ = {
      transformBuiltinAttributeNames: {
        rename: {
          className: 'renamed-class',
          ref: 'renamed-ref',
          textMaxline: 'custom-maxline',
        },
      },
    };
    const ref = rs.fn();

    expect(
      prepareSpreadAttrSlot(-2, 0, {
        className: 'primary',
        ref,
        textMaxline: 2,
      }),
    ).toEqual({
      class: 'primary',
      ref: '-2-0',
      'custom-maxline': 2,
    });
  });

  it('normalizes host spread keys and emits ordinary event values', () => {
    const handleTap = rs.fn();
    const unsupportedWorkletEvent = rs.fn();
    const unsupportedFunctionProp = rs.fn();
    const ref = rs.fn();

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
    const ref = rs.fn();
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
    const spread = Object.create({ ref: rs.fn() }) as Record<string, unknown>;
    spread.id = 'cta';

    expect(prepareSpreadAttrSlot(-4, 1, spread)).toEqual({ id: 'cta' });
  });

  it('returns null for removed spread values', () => {
    expect(prepareSpreadAttrSlot(-4, 0, null)).toBeNull();
    expect(prepareSpreadAttrSlot(-4, 0, false)).toBeNull();
  });

  it('ignores non-host spread props', () => {
    const prepared = prepareSpreadAttrSlot(-5, 0, {
      'worklet:ref': rs.fn(),
      'main-thread:ref': rs.fn(),
      'main-thread:bindtap': rs.fn(),
      'main-thread:gesture': {},
      onReady: rs.fn(),
      title: 'hello',
    });

    expect(prepared).toEqual({ title: 'hello' });
  });
});
