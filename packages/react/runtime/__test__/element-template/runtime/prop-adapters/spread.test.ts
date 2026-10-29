import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEventValue } from '../../../../src/element-template/prop-adapters/event-value.js';
import {
  prepareSpreadAttrSlot,
  prepareTypedSpreadAttrSlot,
} from '../../../../src/element-template/prop-adapters/spread.js';

afterEach(() => {
  lynx.__runtime_configs__ = { transformBuiltinAttributeNames: false };
});

describe('ElementTemplate spread prop adapter', () => {
  it('transforms builtin attribute names and preserves event handler lookup keys', () => {
    lynx.__runtime_configs__ = { transformBuiltinAttributeNames: true };

    const prepared = prepareSpreadAttrSlot(-1, 0, {
      textMaxline: 2,
      tailColorConvert: false,
      onClick: vi.fn(),
      onCatchTap: vi.fn(),
      onReady: null,
      bindchange: vi.fn(),
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
    const ref = vi.fn();

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
        'worklet:bindtap': unsupportedWorkletEvent,
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

  it('ignores non-host spread props and isolates typed host spreads from main-thread capabilities', () => {
    const prepared = prepareSpreadAttrSlot(-5, 0, {
      'worklet:ref': vi.fn(),
      'worklet:bindtap': vi.fn(),
      'worklet:gesture': {},
      'main-thread:custom': () => {},
      onReady: vi.fn(),
      title: 'hello',
    });

    expect(prepared).toEqual({ title: 'hello' });

    const typedPrepared = prepareTypedSpreadAttrSlot(-5, 0, {
      'main-thread:ref': { _wvid: 1 },
      'main-thread:bindtap': { _wkltId: 'tap' },
      'main-thread:gesture': { __isGesture: true, id: 1, type: 0, callbacks: {} },
      title: 'typed',
    });

    expect(typedPrepared).toEqual({ title: 'typed' });
  });

  it('prepares main-thread events, MTRef, and Gesture in compiled spread slots while ignoring inherited keys', () => {
    const tapWorklet = { _wkltId: 'tap-wklt' };
    const captureCatchWorklet = { _wkltId: 'capture-catch-wklt' };
    const globalWorklet = { _wkltId: 'global-wklt' };
    const mtRef = { _wvid: 9 };
    const panGesture = {
      __isGesture: true,
      id: 3,
      type: 0,
      config: { minDistance: 8 },
      callbacks: { onUpdate: { _wkltId: 'pan-update' } },
    };

    const rawSpread = Object.assign(
      Object.create({
        'main-thread:bindinherited': { _wkltId: 'inherited-event' },
        'main-thread:ref': { _wvid: 99 },
        'main-thread:gesture': panGesture,
      }) as Record<string, unknown>,
      {
        id: 'card',
        'main-thread:bindtap': tapWorklet,
        'main-thread:capture-catchtouchmove': captureCatchWorklet,
        'main-thread:global-bindCustom': globalWorklet,
        'main-thread:catchtouchend': null,
        'main-thread:ref': mtRef,
        'main-thread:gesture': panGesture,
      },
    );

    const firstPrepared = prepareSpreadAttrSlot(-6, 1, rawSpread) as Record<string, any>;
    expect(firstPrepared).toMatchObject({
      id: 'card',
      'main-thread:bindtap': { type: 'worklet', value: { _wkltId: 'tap-wklt' } },
      'main-thread:capture-catchtouchmove': { type: 'worklet', value: { _wkltId: 'capture-catch-wklt' } },
      'main-thread:global-bindCustom': { type: 'worklet', value: { _wkltId: 'global-wklt' } },
      'main-thread:catchtouchend': null,
      'main-thread:ref': { type: 'main-thread-ref', value: mtRef },
      'main-thread:gesture': {
        type: 'gesture',
        value: [{ id: 3, type: 0, config: { minDistance: 8 } }],
      },
    });
    expect(firstPrepared).not.toHaveProperty('main-thread:bindinherited');

    // Re-preparing with identical raw callback identities reuses prepared wrappers.
    const nextRawSpread = { ...rawSpread, id: 'card-next' };
    const secondPrepared = prepareSpreadAttrSlot(-6, 1, nextRawSpread, {
      previousPreparedSlots: [null, firstPrepared],
      previousRawSlots: [null, rawSpread],
    }) as Record<string, any>;
    expect(secondPrepared['main-thread:bindtap']).toBe(firstPrepared['main-thread:bindtap']);
    expect(secondPrepared['main-thread:ref']).toBe(firstPrepared['main-thread:ref']);
    expect(
      secondPrepared['main-thread:gesture'].value[0].callbacks[0].callback,
    ).toBe(firstPrepared['main-thread:gesture'].value[0].callbacks[0].callback);

    expect(
      prepareSpreadAttrSlot(-6, 1, {
        'main-thread:ref': undefined,
        'main-thread:gesture': false,
        'main-thread:bindtap': undefined,
      }),
    ).toEqual({
      'main-thread:ref': null,
      'main-thread:gesture': null,
      'main-thread:bindtap': null,
    });

    expect(() => prepareSpreadAttrSlot(-6, 1, { 'main-thread:ref': vi.fn() })).toThrow(
      'ElementTemplate main-thread:ref expects a MainThreadRef object or a main-thread function.',
    );
    expect(() => prepareSpreadAttrSlot(-6, 1, { 'main-thread:gesture': {} })).toThrow(
      'ElementTemplate main-thread:gesture expects a Gesture object.',
    );

    const inheritedOnlySpread = Object.create({
      'main-thread:ref': mtRef,
      'main-thread:gesture': panGesture,
      'main-thread:bindtap': tapWorklet,
    }) as Record<string, unknown>;
    inheritedOnlySpread.id = 'own-only';
    const inheritedPrepared = prepareSpreadAttrSlot(-6, 1, inheritedOnlySpread) as Record<string, any>;
    expect(inheritedPrepared).toEqual({ id: 'own-only' });

    const addedMtsRaw = {
      id: 'added-mts',
      'main-thread:ref': mtRef,
      'main-thread:gesture': panGesture,
      'main-thread:bindtap': tapWorklet,
    };
    const addedFromEmpty = prepareSpreadAttrSlot(-6, 1, addedMtsRaw, {
      previousPreparedSlots: [null, { id: 'own-only', 'main-thread:gesture': null }],
      previousRawSlots: [null, { id: 'own-only', 'main-thread:gesture': null }],
    }) as Record<string, any>;
    expect(addedFromEmpty['main-thread:ref']).toEqual({ type: 'main-thread-ref', value: mtRef });
    expect(addedFromEmpty['main-thread:gesture']).toMatchObject({ type: 'gesture' });
    expect(addedFromEmpty['main-thread:bindtap']).toMatchObject({ type: 'worklet' });
  });

  it('reports invalid main-thread event handlers in development and normalizes them to null', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;
    const originalDev = globalThis.__DEV__;

    try {
      globalThis.__DEV__ = true;
      expect(prepareSpreadAttrSlot(-7, 2, { 'main-thread:bindtap': () => {} })).toEqual({
        'main-thread:bindtap': null,
      });
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'ElementTemplate main-thread event slot -7:2 (main-thread:bindtap) expects a worklet ctx object.',
      );

      reportError.mockClear();
      globalThis.__DEV__ = false;
      expect(prepareSpreadAttrSlot(-7, 2, { 'main-thread:bindtap': () => {} })).toEqual({
        'main-thread:bindtap': null,
      });
      expect(reportError).not.toHaveBeenCalled();
    } finally {
      globalThis.__DEV__ = originalDev;
      lynx.reportError = oldReportError;
    }
  });

  it('re-prepares MTEvent, MTRef, and Gesture when caller mutates a reused spread object in place', () => {
    const firstTap = { _wkltId: 'first-tap' };
    const nextTap = { _wkltId: 'next-tap' };
    const firstRef = { _wvid: 1 };
    const nextRef = { _wvid: 2 };
    const firstGestureCb = { _wkltId: 'first-pan' };
    const nextGestureCb = { _wkltId: 'next-pan' };

    const spread: Record<string, any> = {
      id: 'mutable',
      'main-thread:bindtap': firstTap,
      'main-thread:ref': firstRef,
      'main-thread:gesture': {
        __isGesture: true,
        id: 1,
        type: 0,
        callbacks: { onUpdate: firstGestureCb },
      },
    };

    const firstPrepared = prepareSpreadAttrSlot(1, 0, spread) as Record<string, any>;

    // Mutate the same spread object and nested gesture callbacks in place.
    spread['main-thread:bindtap'] = nextTap;
    spread['main-thread:ref'] = nextRef;
    spread['main-thread:gesture'].callbacks.onUpdate = nextGestureCb;

    const secondPrepared = prepareSpreadAttrSlot(1, 0, spread, {
      previousRawSlots: [spread],
      previousPreparedSlots: [firstPrepared],
    }) as Record<string, any>;

    expect(secondPrepared['main-thread:bindtap']).not.toBe(firstPrepared['main-thread:bindtap']);
    expect(secondPrepared['main-thread:bindtap'].value._wkltId).toBe('next-tap');
    expect(secondPrepared['main-thread:ref']).not.toBe(firstPrepared['main-thread:ref']);
    expect(secondPrepared['main-thread:ref'].value._wvid).toBe(2);
    expect(secondPrepared['main-thread:gesture'].value[0].callbacks[0].callback._wkltId).toBe('next-pan');
  });
});
