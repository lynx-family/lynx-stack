import { afterEach, describe, expect, it, rstest } from '@rstest/core';

import {
  prepareAttributeSlots,
  queueRefAttributeSlotUpdates,
} from '../../../../src/element-template/background/attr-slots.js';
import { resetElementTemplateBackgroundFunctionRuntime } from '../../../../src/element-template/runtime/template/main-thread-background-function.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  adaptRefAttrSlot,
  adaptSpreadAttrSlot,
  clearEtAttrPlanMap,
  type EtAttrAdapter,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { isMTEventNativeWrapper } from '../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import { clearRefState, flushPendingRefs } from '../../../../src/element-template/prop-adapters/ref.js';

function expectMTEventPreparedWrapper(value: unknown): {
  type: 'worklet';
  value: {
    _c?: Record<string, unknown>;
    _execId?: number;
    _jsFn?: Record<string, unknown>;
    _wkltId: string;
  };
} {
  expect(isMTEventNativeWrapper(value)).toBe(true);
  return value as {
    type: 'worklet';
    value: {
      _c?: Record<string, unknown>;
      _execId?: number;
      _jsFn?: Record<string, unknown>;
      _wkltId: string;
    };
  };
}

describe('ElementTemplate attr slot plan registry', () => {
  afterEach(() => {
    clearEtAttrPlanMap();
    clearRefState();
  });

  it('uses undefined as the unregistered template fast path', () => {
    expect(__etAttrPlanMap._et_without_backend_attrs).toBeUndefined();
  });

  it('keeps the map object stable when clearing test state', () => {
    const map = __etAttrPlanMap;
    const adaptSlot: EtAttrAdapter = (_, __, value) => String(value);

    __etAttrPlanMap._et_card = [0, adaptSlot];
    clearEtAttrPlanMap();

    expect(__etAttrPlanMap).toBe(map);
    expect(__etAttrPlanMap._et_card).toBeUndefined();
  });

  it('prepares direct ref slots as native ref markers', () => {
    expect(adaptRefAttrSlot(-2, 0, () => {})).toBe('-2-0');
    expect(adaptRefAttrSlot(17, 3, { current: null })).toBe('17-3');
    expect(adaptRefAttrSlot(-2, 0, 1)).toBe('-2-0');
  });

  it('normalizes empty direct ref slots to null', () => {
    expect(adaptRefAttrSlot(-2, 0, null)).toBeNull();
    expect(adaptRefAttrSlot(-2, 0, undefined)).toBeNull();
  });

  it('rejects non-marker invalid direct ref values like the Snapshot runtime', () => {
    const error = 'Elements\' "ref" property should be a function, or an object created by createRef()';

    expect(() => adaptRefAttrSlot(-2, 0, false)).toThrowError(error);
    expect(() => adaptRefAttrSlot(-2, 0, 'ref')).toThrowError(error);
    expect(() => adaptRefAttrSlot(-2, 0, {})).toThrowError(error);
  });

  it('prepares registered ref attr slots through the attr plan consumer', () => {
    __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];

    expect(prepareAttributeSlots('_et_ref', -2, [() => {}])).toEqual(['-2-0']);
    expect(prepareAttributeSlots('_et_ref', -2, [1])).toEqual(['-2-0']);
  });

  it('wraps direct main-thread event ctx for native consumption', () => {
    const ctx = { _wkltId: 'main-thread-event', _c: { label: 'first' } };

    const wrapper = expectMTEventPreparedWrapper(adaptMTEventAttrSlot(-2, 0, ctx));

    expect(wrapper.type).toBe('worklet');
    expect(wrapper.value).toEqual(expect.objectContaining({
      _c: { label: 'first' },
      _wkltId: 'main-thread-event',
    }));
    expect(wrapper.value).not.toBe(ctx);
    expect(wrapper.value._c).toBe(ctx._c);
    expect(ctx).not.toHaveProperty('_execId');
  });

  it('registers the prepared direct main-thread event ctx on background when runOnBackground is supported', () => {
    const previousFlags = {
      __BACKGROUND__: globalThis.__BACKGROUND__,
      __JS__: globalThis.__JS__,
      __LEPUS__: globalThis.__LEPUS__,
      __MAIN_THREAD__: globalThis.__MAIN_THREAD__,
    };
    const previousSdkVersion = SystemInfo.lynxSdkVersion;
    const rawCtx = { _wkltId: 'main-thread-event' };

    try {
      globalThis.__LEPUS__ = false;
      globalThis.__JS__ = true;
      globalThis.__MAIN_THREAD__ = false;
      globalThis.__BACKGROUND__ = true;
      SystemInfo.lynxSdkVersion = '4.0';

      const wrapper = expectMTEventPreparedWrapper(adaptMTEventAttrSlot(-2, 0, rawCtx));

      expect(wrapper.value._execId).toEqual(expect.any(Number));
      expect(rawCtx).not.toHaveProperty('_execId');
    } finally {
      resetElementTemplateBackgroundFunctionRuntime();
      globalThis.__BACKGROUND__ = previousFlags.__BACKGROUND__;
      globalThis.__JS__ = previousFlags.__JS__;
      globalThis.__LEPUS__ = previousFlags.__LEPUS__;
      globalThis.__MAIN_THREAD__ = previousFlags.__MAIN_THREAD__;
      SystemInfo.lynxSdkVersion = previousSdkVersion;
    }
  });

  it('keeps background exec writes off the raw direct main-thread event root ctx', () => {
    const fn = rstest.fn();
    const rawClosureObject = { _fn: 'ordinary-field', label: 'shared' };
    const rawJsFnHandle = { _fn: fn, _jsFnId: 1 };
    const rawNestedCtx = {
      _wkltId: 'nested',
      _jsFn: {
        handler: rawJsFnHandle,
      },
    };
    const rawCtx = {
      _wkltId: 'main-thread-event',
      _c: {
        nested: rawNestedCtx,
        object: rawClosureObject,
      },
    };

    const wrapper = expectMTEventPreparedWrapper(adaptMTEventAttrSlot(-2, 0, rawCtx));
    const preparedNestedCtx = wrapper.value._c!.nested as {
      _execId?: number;
      _jsFn: Record<string, { _execId?: number; _fn?: unknown; _jsFnId?: number }>;
      _wkltId: string;
    };
    const preparedJsFnHandle = preparedNestedCtx._jsFn.handler;

    expect(wrapper.value).not.toBe(rawCtx);
    expect(wrapper.value._c).toBe(rawCtx._c);
    expect(preparedNestedCtx).toBe(rawNestedCtx);
    expect(wrapper.value._c!.object).toBe(rawClosureObject);
    expect(preparedJsFnHandle).toBe(rawJsFnHandle);
    expect(preparedJsFnHandle._fn).toBe(fn);

    wrapper.value._execId = 71;

    expect(rawCtx).not.toHaveProperty('_execId');
  });

  it('reuses the previous prepared direct main-thread event wrapper for the same raw ctx', () => {
    const ctx = { _wkltId: 'main-thread-event' };
    const firstWrapper = adaptMTEventAttrSlot(-2, 0, ctx);

    expect(adaptMTEventAttrSlot(-2, 0, ctx, {
      previousPreparedSlots: [firstWrapper],
      previousRawSlots: [ctx],
    })).toBe(firstWrapper);

    expect(adaptMTEventAttrSlot(-2, 0, { _wkltId: 'main-thread-event' }, {
      previousPreparedSlots: [firstWrapper],
      previousRawSlots: [ctx],
    })).not.toBe(firstWrapper);
  });

  it('normalizes empty direct main-thread event slots to null', () => {
    expect(adaptMTEventAttrSlot(-2, 0, null)).toBeNull();
    expect(adaptMTEventAttrSlot(-2, 0, undefined)).toBeNull();
    expect(adaptMTEventAttrSlot(-2, 0, false)).toBeNull();
  });

  it('reports invalid direct main-thread event values without mutating them', () => {
    const reportError = rstest.spyOn(lynx, 'reportError');

    expect(adaptMTEventAttrSlot(-2, 0, true)).toBeNull();
    expect(adaptMTEventAttrSlot(-2, 0, 'handler')).toBeNull();
    expect(adaptMTEventAttrSlot(-2, 0, {})).toBeNull();
    expect(adaptMTEventAttrSlot(-2, 0, { _lepusWorkletHash: 'legacy' })).toBeNull();
    expect(adaptMTEventAttrSlot(-2, 0, { _wkltId: 1 })).toBeNull();
    expect(reportError).toHaveBeenCalledTimes(5);
    expect(reportError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    reportError.mockClear();
    (globalThis as unknown as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  });

  it('prepares registered direct main-thread event slots through the attr plan consumer', () => {
    const ctx = { _wkltId: 'main-thread-event' };
    __etAttrPlanMap._et_mt_event = [0, adaptMTEventAttrSlot];

    const preparedSlots = prepareAttributeSlots('_et_mt_event', -2, [ctx]);
    const wrapper = expectMTEventPreparedWrapper(preparedSlots[0]);

    expect(wrapper.value).toEqual(expect.objectContaining({
      _wkltId: 'main-thread-event',
    }));
    expect(wrapper.value).not.toBe(ctx);
    expect(
      prepareAttributeSlots('_et_mt_event', -2, [ctx], {
        previousPreparedSlots: preparedSlots,
        previousRawSlots: [ctx],
      })[0],
    ).toBe(preparedSlots[0]);
  });

  it('skips queued ref effects for templates without attr plans', () => {
    expect(() => {
      queueRefAttributeSlotUpdates('_et_without_backend_attrs', -2, [() => {}]);
    }).not.toThrow();
  });

  it('queues registered ref slot updates from previous and next raw slots', () => {
    const oldRef = rstest.fn();
    const newRef = rstest.fn();
    __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];

    queueRefAttributeSlotUpdates('_et_ref', -2, [oldRef], [newRef]);
    flushPendingRefs();

    expect(oldRef).toHaveBeenCalledWith(null);
    expect(newRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
  });

  it('queues every ref-bearing attr slot independently', () => {
    const directRef = rstest.fn();
    const objectRef = { current: null };
    const spreadRef = rstest.fn();
    __etAttrPlanMap._et_multi_ref = [
      0,
      adaptRefAttrSlot,
      1,
      adaptRefAttrSlot,
      2,
      adaptSpreadAttrSlot,
    ];

    const rawSlots = [directRef, objectRef, { ref: spreadRef }];

    expect(prepareAttributeSlots('_et_multi_ref', -7, rawSlots)).toEqual([
      '-7-0',
      '-7-1',
      { ref: '-7-2' },
    ]);
    queueRefAttributeSlotUpdates('_et_multi_ref', -7, undefined, rawSlots);
    flushPendingRefs();

    expect(directRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-7-0]',
    }));
    expect(objectRef.current).toMatchObject({
      selector: '[ref=-7-1]',
    });
    expect(spreadRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-7-2]',
    }));
  });

  it('queues spread ref cleanup without detaching sibling direct refs', () => {
    const directRef = rstest.fn();
    const spreadRef = rstest.fn();
    __etAttrPlanMap._et_multi_ref = [
      0,
      adaptRefAttrSlot,
      1,
      adaptSpreadAttrSlot,
    ];

    queueRefAttributeSlotUpdates(
      '_et_multi_ref',
      -7,
      [directRef, { ref: spreadRef }],
      [directRef, { ref: undefined }],
    );
    flushPendingRefs();

    expect(directRef).not.toHaveBeenCalled();
    expect(spreadRef).toHaveBeenCalledWith(null);
  });
});
