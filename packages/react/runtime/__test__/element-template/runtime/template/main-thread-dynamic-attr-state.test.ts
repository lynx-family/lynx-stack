// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  adaptMTRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  attachMainThreadDynamicAttrRefsForSubtree,
  clearMainThreadDynamicAttrState,
  deleteMainThreadDynamicAttrStateForSubtree,
  detachMainThreadDynamicAttrRefsForSubtree,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
  prepareMainThreadDynamicAttrSlotsForNative,
  updateMainThreadEventAttrSlot as setMTEventSlot,
  updateMainThreadRefAttrSlot as setMTRefSlotImpl,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';

import { prepareMainThreadBackgroundFunctionCtx } from '../../../../src/element-template/runtime/template/main-thread-background-function.js';
import { prepareMTEventCtxForNative } from '../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import type { MTEventNativeWrapper } from '../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import type { JsFnHandle, Worklet } from '../../../../src/worklet-runtime/bindings/types.js';
import { hydrateCtx } from '../../../../src/worklet-runtime/hydrate.js';
import { initWorklet } from '../../../../src/worklet-runtime/workletRuntime.js';

const MT_EVENT_TEMPLATE = '_et_mt_event';
const MT_REF_TEMPLATE = '_et_mt_ref';
const TEST_NATIVE_REF = { id: 'dynamic-attr-target' } as unknown as ElementTemplateHandle;

function setMTRefSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  isHydration = false,
  nativeRef: ElementTemplateHandle = TEST_NATIVE_REF,
): void {
  setMTRefSlotImpl(handleId, attrSlotIndex, value, nativeRef, isHydration);
}

function registerMTRefSlots(handleId: number, ...slotIndexes: number[]): void {
  __etAttrPlanMap[MT_REF_TEMPLATE] = slotIndexes.flatMap(slotIndex => [
    slotIndex,
    adaptMTRefAttrSlot,
  ]);
  initializeMainThreadDynamicAttrSlots(handleId, MT_REF_TEMPLATE, []);
}

function installJsFunctionLifecycleManager(): {
  addRef: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const previousWorkletImpl = globalThis.lynxWorkletImpl;
  const addRef = vi.fn();
  globalThis.lynxWorkletImpl = {
    ...previousWorkletImpl,
    _jsFunctionLifecycleManager: {
      addRef,
      prepareWorkletCtx: vi.fn(),
      retainWorkletCtx: (ctx: { _execId?: number }) => {
        if (ctx._execId !== undefined) addRef(ctx._execId, ctx);
      },
    },
  } as typeof globalThis.lynxWorkletImpl;
  return {
    addRef,
    restore: () => {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    },
  };
}

function installRefRuntime(): {
  updateWorkletRef: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const previousWorkletImpl = globalThis.lynxWorkletImpl;
  const updateWorkletRef = vi.fn();
  globalThis.lynxWorkletImpl = {
    ...previousWorkletImpl,
    _refImpl: {
      updateWorkletRef,
    },
  } as typeof globalThis.lynxWorkletImpl;
  return {
    updateWorkletRef,
    restore: () => {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    },
  };
}

describe('main-thread dynamic attr state', () => {
  afterEach(() => {
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
  });

  it.each([0, 1, 2, 3, 'interleaved'] as const)(
    'isolates shared first-screen captures with execution mask %s',
    (mask) => {
      const previousWorkletImpl = globalThis.lynxWorkletImpl;
      const previousSdkVersion = SystemInfo.lynxSdkVersion;
      const register = vi.spyOn(FinalizationRegistry.prototype, 'register');
      try {
        SystemInfo.lynxSdkVersion = '4.0';
        vi.stubGlobal('__JS__', false);
        globalThis.lynxWorkletImpl = {
          ...previousWorkletImpl,
          _jsFunctionLifecycleManager: undefined,
        };
        initWorklet();
        globalThis.registerWorklet(
          'main-thread',
          'shared-callback',
          function(this: { _jsFn: { callback: JsFnHandle } }) {
            return () => this._jsFn.callback;
          },
        );
        const shared = { _isFirstScreen: true };
        const raw = { _wkltId: 'shared-callback', _jsFn: { callback: shared, alias: shared } };
        const first = prepareMTEventCtxForNative(raw) as unknown as MTEventNativeWrapper;
        const second = prepareMTEventCtxForNative(raw) as unknown as MTEventNativeWrapper;
        prepareMainThreadBackgroundFunctionCtx(first.value);
        prepareMainThreadBackgroundFunctionCtx(second.value);
        setMTEventSlot(17, 0, first);
        setMTEventSlot(18, 0, second);
        const escaped: (() => JsFnHandle)[] = [];
        const bindings = [first, second];
        for (const [index, old] of bindings.entries()) {
          if (typeof mask === 'number' && (mask & (1 << index))) {
            escaped[index] = globalThis.runWorklet(JSON.parse(JSON.stringify(old.value)), []) as () => JsFnHandle;
            expect(escaped[index]!()).toEqual({ _isFirstScreen: true });
            expect(old.value._jsFn?.alias).toBe(escaped[index]!());
          }
        }
        for (const [index, old] of bindings.entries()) {
          if (mask === 'interleaved' && index === 1) {
            escaped[index] = globalThis.runWorklet(JSON.parse(JSON.stringify(old.value)), []) as () => JsFnHandle;
            expect(escaped[index]!()).toEqual({ _isFirstScreen: true });
          }
          hydrateCtx(
            {
              _wkltId: 'shared-callback',
              _execId: 11 + index,
              _jsFn: { callback: { _jsFnId: 1 }, alias: { _jsFnId: 1 } },
            },
            old.value as Worklet,
          );
        }
        if (escaped[0] && escaped[1]) expect(escaped[0]()).not.toBe(escaped[1]());
        deleteMainThreadDynamicAttrStateForSubtree([17, 18]);
        for (const [index, callback] of escaped.entries()) {
          if (!callback) continue;
          expect(callback()).toMatchObject({ _isFirstScreen: false, _execId: 11 + index, _jsFnId: 1 });
          expect(register).toHaveBeenCalledWith(callback(), 11 + index);
        }
        expect(register.mock.calls.some(([target]) => target === shared)).toBe(false);
        expect(raw._jsFn.callback).toEqual({ _isFirstScreen: true });
      } finally {
        register.mockRestore();
        vi.unstubAllGlobals();
        SystemInfo.lynxSdkVersion = previousSdkVersion;
        globalThis.lynxWorkletImpl = previousWorkletImpl;
      }
    },
  );

  it('records native-held MTEvent ctx by handle and slot without storing the wrapper', () => {
    const ctx = { _wkltId: 'tap' };
    const wrapper = { type: 'worklet', value: ctx };
    setMTEventSlot(17, 3, wrapper);

    expect(getMainThreadDynamicAttrState(17, 3)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
    expect(getMainThreadDynamicAttrState(17, 3)?.nativeHeldValue).not.toBe(wrapper);
  });

  it('keeps MTEvent and MTRef state independent for the same spread-capable slot', () => {
    const ctx = { _wkltId: 'tap' };
    const ref = { _wvid: 7 };

    setMTEventSlot(17, 3, { type: 'worklet', value: ctx });
    setMTRefSlot(17, 3, { type: 'main-thread-ref', value: ref });
    setMTRefSlot(17, 3, null);

    expect(getMainThreadDynamicAttrState(17, 3)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('records MTRef values by handle and slot without storing the wrapper', () => {
    const ref = { _wvid: 7 };
    const wrapper = { type: 'main-thread-ref', value: ref };
    registerMTRefSlots(17, 3);

    setMTRefSlot(17, 3, wrapper);

    expect(getMainThreadDynamicAttrState(17, 3)).toEqual({
      kind: 'mt-ref',
      value: ref,
    });
    expect(getMainThreadDynamicAttrState(17, 3)).not.toBe(wrapper);
  });

  it('attaches and detaches MTRef values for list-managed subtrees', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const nativeRef = { id: 'target' } as unknown as ElementTemplateHandle;
    const firstRef = { _wvid: 7 };
    const nextRef = { _wvid: 8 };

    try {
      registerMTRefSlots(17, 0);
      setMTRefSlot(17, 0, { type: 'main-thread-ref', value: firstRef });

      attachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: nativeRef }]);

      expect(updateWorkletRef).toHaveBeenCalledWith(firstRef, nativeRef);
      expect(getMainThreadDynamicAttrState(17, 0)).toEqual({
        kind: 'mt-ref',
        value: firstRef,
      });

      updateWorkletRef.mockClear();
      attachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: nativeRef }]);
      expect(updateWorkletRef).not.toHaveBeenCalled();

      updateWorkletRef.mockClear();
      detachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: nativeRef }]);

      expect(updateWorkletRef).toHaveBeenCalledWith(firstRef, null);
      expect(getMainThreadDynamicAttrState(17, 0)).toEqual({
        kind: 'mt-ref',
        value: firstRef,
      });

      updateWorkletRef.mockClear();
      detachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: nativeRef }]);
      expect(updateWorkletRef).not.toHaveBeenCalled();

      updateWorkletRef.mockClear();
      setMTRefSlot(
        17,
        0,
        { type: 'main-thread-ref', value: nextRef },
        false,
        nativeRef,
      );

      expect(updateWorkletRef).not.toHaveBeenCalled();

      attachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: nativeRef }]);

      expect(updateWorkletRef).toHaveBeenCalledWith(nextRef, nativeRef);
      expect(getMainThreadDynamicAttrState(17, 0)).toEqual({
        kind: 'mt-ref',
        value: nextRef,
      });
    } finally {
      restore();
    }
  });

  it('attaches a later MTRef value after an empty slot materializes', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const ref = { _wvid: 7 };

    try {
      registerMTRefSlots(17, 0);
      attachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: TEST_NATIVE_REF }]);
      expect(updateWorkletRef).not.toHaveBeenCalled();

      setMTRefSlot(17, 0, { type: 'main-thread-ref', value: ref });

      expect(updateWorkletRef).toHaveBeenCalledWith(ref, TEST_NATIVE_REF);
    } finally {
      restore();
    }
  });

  it('updates MTRef attachment state before invoking callbacks', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const nativeRef = { id: 'target' } as unknown as ElementTemplateHandle;
    const ref = { _wvid: 7 };
    const subtree = [{ uid: 17, ref: nativeRef }];

    try {
      registerMTRefSlots(17, 0);
      setMTRefSlot(17, 0, { type: 'main-thread-ref', value: ref });

      updateWorkletRef.mockImplementationOnce(() => {
        attachMainThreadDynamicAttrRefsForSubtree(subtree);
      });
      attachMainThreadDynamicAttrRefsForSubtree(subtree);
      expect(updateWorkletRef).toHaveBeenCalledTimes(1);
      expect(updateWorkletRef).toHaveBeenCalledWith(ref, nativeRef);

      updateWorkletRef.mockClear();
      updateWorkletRef.mockImplementationOnce(() => {
        detachMainThreadDynamicAttrRefsForSubtree(subtree);
      });
      detachMainThreadDynamicAttrRefsForSubtree(subtree);
      expect(updateWorkletRef).toHaveBeenCalledTimes(1);
      expect(updateWorkletRef).toHaveBeenCalledWith(ref, null);
    } finally {
      restore();
    }
  });

  it('does not clean an already detached MTRef when setting null', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const ref = { _wvid: 7 };
    const subtree = [{ uid: 17, ref: TEST_NATIVE_REF }];

    try {
      registerMTRefSlots(17, 0);
      setMTRefSlot(17, 0, { type: 'main-thread-ref', value: ref });
      attachMainThreadDynamicAttrRefsForSubtree(subtree);
      detachMainThreadDynamicAttrRefsForSubtree(subtree);

      updateWorkletRef.mockClear();
      setMTRefSlot(17, 0, null);

      expect(updateWorkletRef).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('tracks prepared MTEvent input once before committing initial slots', () => {
    const { addRef, restore } = installJsFunctionLifecycleManager();
    const ctx = { _execId: 99, _wkltId: 'tap' };
    __etAttrPlanMap[MT_EVENT_TEMPLATE] = [0, adaptMTEventAttrSlot];

    try {
      const slots = [{ type: 'worklet', value: ctx }];
      prepareMainThreadDynamicAttrSlotsForNative(MT_EVENT_TEMPLATE, slots);
      expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
      initializeMainThreadDynamicAttrSlots(17, MT_EVENT_TEMPLATE, slots);

      expect(addRef).toHaveBeenCalledExactlyOnceWith(99, ctx);
    } finally {
      restore();
    }
  });

  it('commits MTEvent updates without repeating prepared input tracking', () => {
    const { addRef, restore } = installJsFunctionLifecycleManager();
    const ctx = { _execId: 100, _wkltId: 'tap' };

    try {
      prepareMainThreadBackgroundFunctionCtx(ctx);
      expect(getMainThreadDynamicAttrState(17, 3)).toBeUndefined();
      setMTEventSlot(17, 3, { type: 'worklet', value: ctx });

      expect(addRef).toHaveBeenCalledExactlyOnceWith(100, ctx);
    } finally {
      restore();
    }
  });

  it('retains callback MTRef values recorded from updates', () => {
    const { addRef, restore } = installJsFunctionLifecycleManager();
    const callback = { _execId: 101, _wkltId: 'ref-callback' };

    try {
      registerMTRefSlots(17, 3);
      setMTRefSlot(17, 3, {
        type: 'main-thread-ref',
        value: callback,
      });

      expect(addRef).toHaveBeenCalledWith(101, callback);
    } finally {
      restore();
    }
  });

  it('keeps independent entries for each handle and attr slot', () => {
    const first = { _wkltId: 'first' };
    const second = { _wkltId: 'second' };
    const third = { _wkltId: 'third' };
    setMTEventSlot(17, 0, { type: 'worklet', value: first });
    setMTEventSlot(17, 1, { type: 'worklet', value: second });
    setMTEventSlot(18, 0, { type: 'worklet', value: third });

    expect(getMainThreadDynamicAttrState(17, 0)?.nativeHeldValue).toBe(first);
    expect(getMainThreadDynamicAttrState(17, 1)?.nativeHeldValue).toBe(second);
    expect(getMainThreadDynamicAttrState(18, 0)?.nativeHeldValue).toBe(third);
  });

  it('keeps MTEvent and MTRef states independent on the same handle', () => {
    const ctx = { _wkltId: 'tap' };
    const ref = { _wvid: 8 };
    __etAttrPlanMap._et_mixed = [
      0,
      adaptMTEventAttrSlot,
      1,
      adaptMTRefAttrSlot,
    ];
    initializeMainThreadDynamicAttrSlots(17, '_et_mixed', []);

    setMTEventSlot(17, 0, { type: 'worklet', value: ctx });
    setMTRefSlot(17, 1, { type: 'main-thread-ref', value: ref });

    expect(getMainThreadDynamicAttrState(17, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
    expect(getMainThreadDynamicAttrState(17, 1)).toEqual({
      kind: 'mt-ref',
      value: ref,
    });
  });

  it('records MTEvent wrappers only for eligible native attribute slots', () => {
    const ctx = { _wkltId: 'tap' };
    __etAttrPlanMap[MT_EVENT_TEMPLATE] = [1, adaptMTEventAttrSlot];

    initializeMainThreadDynamicAttrSlots(17, MT_EVENT_TEMPLATE, [
      null,
      { type: 'worklet', value: ctx },
      'plain',
    ]);

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 1)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
    expect(getMainThreadDynamicAttrState(17, 2)).toBeUndefined();
  });

  it('records MTRef wrappers only for eligible native attribute slots', () => {
    const ref = { _wvid: 7 };
    __etAttrPlanMap[MT_REF_TEMPLATE] = [1, adaptMTRefAttrSlot];

    initializeMainThreadDynamicAttrSlots(17, MT_REF_TEMPLATE, [
      { type: 'main-thread-ref', value: { _wvid: 6 } },
      { type: 'main-thread-ref', value: ref },
      'plain',
    ]);

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 1)).toEqual({
      kind: 'mt-ref',
      value: ref,
    });
    expect(getMainThreadDynamicAttrState(17, 2)).toBeUndefined();
  });

  it('deletes previous MTEvent state when a slot is cleared', () => {
    const ctx = { _wkltId: 'tap' };
    setMTEventSlot(17, 3, { type: 'worklet', value: ctx });
    setMTEventSlot(17, 3, null);
    expect(getMainThreadDynamicAttrState(17, 3)).toBeUndefined();
  });

  it('deletes previous MTRef state when a slot is cleared', () => {
    const ref = { _wvid: 7 };
    registerMTRefSlots(17, 3);

    setMTRefSlot(17, 3, { type: 'main-thread-ref', value: ref });
    setMTRefSlot(17, 3, null);
    expect(getMainThreadDynamicAttrState(17, 3)).toBeUndefined();
  });

  it('deletes every state entry owned by removed subtree handles', () => {
    setMTEventSlot(17, 0, { type: 'worklet', value: { _wkltId: 'a' } });
    setMTEventSlot(17, 1, { type: 'worklet', value: { _wkltId: 'b' } });
    setMTEventSlot(18, 0, { type: 'worklet', value: { _wkltId: 'c' } });
    registerMTRefSlots(19, 0);
    setMTRefSlot(19, 0, { type: 'main-thread-ref', value: { _wvid: 7 } });

    deleteMainThreadDynamicAttrStateForSubtree([17, 19]);

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 1)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(18, 0)).toBeDefined();
    expect(getMainThreadDynamicAttrState(19, 0)).toBeUndefined();
  });

  it('cleans MTRef values when clearing dynamic attr state', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const previousRunWorklet = globalThis.runWorklet;
    const ref = { _wvid: 7 };
    const callbackCleanup = vi.fn();
    const callback = { _wkltId: 'ref-callback', _unmount: callbackCleanup };
    globalThis.runWorklet = vi.fn(() => callbackCleanup);

    try {
      registerMTRefSlots(17, 0);
      setMTRefSlot(
        17,
        0,
        { type: 'main-thread-ref', value: ref },
        false,
        { id: 'ref-target' } as unknown as ElementTemplateHandle,
      );
      registerMTRefSlots(18, 0);
      setMTRefSlot(
        18,
        0,
        { type: 'main-thread-ref', value: callback },
        false,
        { id: 'callback-target' } as unknown as ElementTemplateHandle,
      );
      attachMainThreadDynamicAttrRefsForSubtree([
        { uid: 17, ref: { id: 'ref-target' } as unknown as ElementTemplateHandle },
        { uid: 18, ref: { id: 'callback-target' } as unknown as ElementTemplateHandle },
      ]);

      clearMainThreadDynamicAttrState();

      expect(updateWorkletRef).toHaveBeenCalledWith(ref, null);
      expect(callbackCleanup).toHaveBeenCalledTimes(1);
      expect(globalThis.runWorklet).toHaveBeenCalledWith(callback, [{ elementRefptr: { id: 'callback-target' } }]);
      expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
      expect(getMainThreadDynamicAttrState(18, 0)).toBeUndefined();
    } finally {
      globalThis.runWorklet = previousRunWorklet;
      restore();
    }
  });

  it('runs callback MTRef with null when cleanup has no unmount handle', () => {
    const previousRunWorklet = globalThis.runWorklet;
    const callback = { _wkltId: 'ref-callback-without-cleanup' };
    globalThis.runWorklet = vi.fn();

    try {
      registerMTRefSlots(17, 0);
      setMTRefSlot(
        17,
        0,
        { type: 'main-thread-ref', value: callback },
        false,
        { id: 'callback-target' } as unknown as ElementTemplateHandle,
      );
      attachMainThreadDynamicAttrRefsForSubtree([
        { uid: 17, ref: { id: 'callback-target' } as unknown as ElementTemplateHandle },
      ]);

      clearMainThreadDynamicAttrState();

      expect(globalThis.runWorklet).toHaveBeenCalledWith(callback, [null]);
      expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    } finally {
      globalThis.runWorklet = previousRunWorklet;
    }
  });

  it('cleans MTRef values when deleting removed subtree state', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const ref = { _wvid: 8 };

    try {
      registerMTRefSlots(17, 0);
      setMTRefSlot(
        17,
        0,
        { type: 'main-thread-ref', value: ref },
        false,
        { id: 'target' } as unknown as ElementTemplateHandle,
      );
      attachMainThreadDynamicAttrRefsForSubtree([
        { uid: 17, ref: { id: 'target' } as unknown as ElementTemplateHandle },
      ]);

      deleteMainThreadDynamicAttrStateForSubtree([17]);

      expect(updateWorkletRef).toHaveBeenCalledWith(ref, null);
      expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('does not clean MTRef values that never attached', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const deletedRef = { _wvid: 9 };
    const clearedRef = { _wvid: 10 };

    try {
      registerMTRefSlots(17, 0);
      setMTRefSlot(17, 0, { type: 'main-thread-ref', value: deletedRef });
      registerMTRefSlots(18, 0);
      setMTRefSlot(18, 0, { type: 'main-thread-ref', value: clearedRef });

      deleteMainThreadDynamicAttrStateForSubtree([17]);
      clearMainThreadDynamicAttrState();

      expect(updateWorkletRef).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
      expect(getMainThreadDynamicAttrState(18, 0)).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('hydrates MTEvent state when hydration replaces native-held ctx', () => {
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };

    try {
      setMTEventSlot(17, 0, { type: 'worklet', value: oldCtx });
      setMTEventSlot(17, 0, { type: 'worklet', value: nextCtx }, true);

      expect(hydrateCtx).toHaveBeenCalledWith(nextCtx, oldCtx);
      expect(getMainThreadDynamicAttrState(17, 0)?.nativeHeldValue).toBe(nextCtx);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('does not hydrate MTEvent state for ordinary updates', () => {
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };

    try {
      setMTEventSlot(17, 0, { type: 'worklet', value: oldCtx });
      setMTEventSlot(17, 0, { type: 'worklet', value: nextCtx });

      expect(hydrateCtx).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(17, 0)?.nativeHeldValue).toBe(nextCtx);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });
});
