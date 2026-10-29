// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushElementTemplate } from '../../../../src/element-template/native/flush.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  adaptMTRefAttrSlot,
  adaptSpreadAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  attachMainThreadDynamicAttrRefsForSubtree,
  applyPendingMainThreadRefAttachments,
  clearMainThreadDynamicAttrState,
  deleteMainThreadDynamicAttrStateForSubtree,
  detachMainThreadDynamicAttrRefsForSubtree,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
  isSpreadDynamicAttrSlot,
  prepareMainThreadDynamicAttrSlotsForNative,
  prepareSpreadAttrSlotForNative,
  updateMainThreadEventAttrSlot as setMTEventSlot,
  updateMainThreadRefAttrSlot as setMTRefSlotImpl,
  updateSpreadAttrSlot,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';

import { retainMainThreadBackgroundFunctionCtx } from '../../../../src/element-template/runtime/template/main-thread-background-function.js';
import { prepareMTEventCtxForNative } from '../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import type { MTEventNativeWrapper } from '../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import type { Worklet } from '../../../../src/worklet-runtime/bindings/types.js';
import { initWorklet } from '../../../../src/worklet-runtime/workletRuntime.js';

const MT_EVENT_TEMPLATE = '_et_mt_event';
const MT_REF_TEMPLATE = '_et_mt_ref';
const TEST_NATIVE_REF = { id: 'dynamic-attr-template' } as unknown as ElementTemplateHandle;
const TEST_ELEMENT_REF = { id: 'dynamic-attr-element' } as unknown as ElementRef;

function completeRefAttachments(): void {
  applyPendingMainThreadRefAttachments();
}

function attachAndComplete(handles: Parameters<typeof attachMainThreadDynamicAttrRefsForSubtree>[0]): void {
  attachMainThreadDynamicAttrRefsForSubtree(handles);
  completeRefAttachments();
}

function setMTRefSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  isHydration = false,
  nativeRef: ElementTemplateHandle = TEST_NATIVE_REF,
): void {
  setMTRefSlotImpl(handleId, attrSlotIndex, value, nativeRef, isHydration);
  completeRefAttachments();
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
  beforeEach(() => {
    vi.stubGlobal('__GetElementByAttrSlot', vi.fn(() => TEST_ELEMENT_REF));
  });
  afterEach(() => {
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
  });

  it('executes the original Native-held event context before and after hydration', () => {
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    const previousSdkVersion = SystemInfo.lynxSdkVersion;
    try {
      SystemInfo.lynxSdkVersion = '4.0';
      vi.stubGlobal('__JS__', false);
      initWorklet();
      globalThis.registerWorklet('main-thread', 'callback', function(this: Worklet) {
        return this._jsFn;
      });
      const first = prepareMTEventCtxForNative({
        _wkltId: 'callback',
        _jsFn: { cb: { _isFirstScreen: true } },
      }) as unknown as MTEventNativeWrapper;
      retainMainThreadBackgroundFunctionCtx(first.value);
      setMTEventSlot(17, 0, first);
      const deliver = (ctx: object) => globalThis.runWorklet(ctx, []);
      expect(deliver(first.value)).toBe(first.value._jsFn);
      const next = { _wkltId: 'callback', _execId: 11, _jsFn: { cb: { _jsFnId: 1 } } };
      retainMainThreadBackgroundFunctionCtx(next);
      setMTEventSlot(17, 0, { type: 'worklet', value: next }, true);
      expect(deliver(next)).toBe(next._jsFn);
      expect(next._jsFn.cb).toEqual({ _jsFnId: 1, _execId: 11 });
      expect(getMainThreadDynamicAttrState(17, 0)).toEqual({ kind: 'mt-event', nativeHeldValue: next });
      deleteMainThreadDynamicAttrStateForSubtree([17]);
      expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
      SystemInfo.lynxSdkVersion = previousSdkVersion;
      vi.unstubAllGlobals();
    }
  });

  it('resolves distinct inner nodes before native flush without a layout hook', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const flush = vi.fn();
    vi.stubGlobal('__FlushElementTree', flush);
    const firstRef = { _wvid: 7 };
    const secondRef = { _wvid: 8 };
    const secondElement = { id: 'second-inner-node' } as unknown as ElementRef;
    vi.mocked(__GetElementByAttrSlot).mockImplementation((_handle, slot) =>
      slot === 0 ? TEST_ELEMENT_REF : secondElement
    );
    try {
      registerMTRefSlots(17, 0, 1);
      setMTRefSlot(17, 0, { type: 'main-thread-ref', value: firstRef });
      setMTRefSlot(17, 1, { type: 'main-thread-ref', value: secondRef });
      attachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: TEST_NATIVE_REF }]);
      expect(updateWorkletRef).not.toHaveBeenCalled();
      const options = { emptyPatch: true, asyncFlush: true };
      flushElementTemplate(options);
      expect(updateWorkletRef.mock.calls).toEqual([[firstRef, TEST_ELEMENT_REF], [secondRef, secondElement]]);
      expect(flush).toHaveBeenCalledWith(undefined, options);
      expect(updateWorkletRef.mock.invocationCallOrder.at(-1)).toBeLessThan(flush.mock.invocationCallOrder[0]!);
    } finally {
      restore();
    }
  });

  it('fails visibly when native cannot resolve a submitted ref target during ref delivery', () => {
    vi.mocked(__GetElementByAttrSlot).mockReturnValue(null);
    registerMTRefSlots(17, 0);
    setMTRefSlot(17, 0, { type: 'main-thread-ref', value: { _wvid: 7 } });
    attachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: TEST_NATIVE_REF }]);
    expect(() => applyPendingMainThreadRefAttachments()).toThrow('target 17:0 could not be materialized');
  });

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

      attachAndComplete([{ uid: 17, ref: nativeRef }]);

      expect(updateWorkletRef).toHaveBeenCalledWith(firstRef, TEST_ELEMENT_REF);
      expect(getMainThreadDynamicAttrState(17, 0)).toEqual({
        kind: 'mt-ref',
        value: firstRef,
      });

      updateWorkletRef.mockClear();
      attachAndComplete([{ uid: 17, ref: nativeRef }]);
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

      attachAndComplete([{ uid: 17, ref: nativeRef }]);

      expect(updateWorkletRef).toHaveBeenCalledWith(nextRef, TEST_ELEMENT_REF);
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
      attachAndComplete([{ uid: 17, ref: TEST_NATIVE_REF }]);
      expect(updateWorkletRef).not.toHaveBeenCalled();

      setMTRefSlot(17, 0, { type: 'main-thread-ref', value: ref });

      expect(updateWorkletRef).toHaveBeenCalledWith(ref, TEST_ELEMENT_REF);
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
        attachAndComplete(subtree);
      });
      attachAndComplete(subtree);
      expect(updateWorkletRef).toHaveBeenCalledTimes(1);
      expect(updateWorkletRef).toHaveBeenCalledWith(ref, TEST_ELEMENT_REF);

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
      attachAndComplete(subtree);
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
      retainMainThreadBackgroundFunctionCtx(ctx);
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
    const callback = { _wkltId: 'ref-callback' };
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
      attachAndComplete([
        { uid: 17, ref: { id: 'ref-target' } as unknown as ElementTemplateHandle },
        { uid: 18, ref: { id: 'callback-target' } as unknown as ElementTemplateHandle },
      ]);

      clearMainThreadDynamicAttrState();

      expect(updateWorkletRef).toHaveBeenCalledWith(ref, null);
      expect(callbackCleanup).toHaveBeenCalledTimes(1);
      expect(globalThis.runWorklet).toHaveBeenCalledWith(callback, [{ elementRefptr: TEST_ELEMENT_REF }]);
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
      attachAndComplete([
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
      attachAndComplete([
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

  it('retains spread MTEvent, Gesture, and callback MTRef once before Native and keeps state intact on Native rejection', () => {
    const { addRef, restore } = installJsFunctionLifecycleManager();
    const { updateWorkletRef, restore: restoreRefs } = installRefRuntime();
    const eventCtx = { _execId: 201, _wkltId: 'spread-tap' };
    const gestureCb = { _execId: 202, _wkltId: 'spread-pan' };
    const refCb = { _execId: 203, _wkltId: 'spread-ref-cb' };
    const initialObjectRef = { _wvid: 55 };
    __etAttrPlanMap._et_spread_retain = [0, adaptSpreadAttrSlot];

    try {
      const initialSlot = {
        id: 'card',
        'main-thread:bindtap': { type: 'worklet', value: eventCtx },
        'main-thread:gesture': {
          type: 'gesture',
          value: [{
            id: 1,
            type: 0,
            config: {},
            callbacks: [{ name: 'onUpdate', callback: gestureCb }],
            relationMap: { waitFor: [], simultaneous: [], continueWith: [] },
          }],
        },
        'main-thread:ref': { type: 'main-thread-ref', value: initialObjectRef },
      };

      const nativeSlots = prepareMainThreadDynamicAttrSlotsForNative('_et_spread_retain', [initialSlot]);
      expect(nativeSlots?.[0]).toEqual({
        id: 'card',
        'main-thread:bindtap': { type: 'worklet', value: eventCtx },
        'main-thread:gesture': initialSlot['main-thread:gesture'],
        'has-react-ref': true,
        flatten: false,
      });
      expect(addRef.mock.calls).toEqual([
        [201, eventCtx],
        [202, gestureCb],
      ]);

      initializeMainThreadDynamicAttrSlots(17, '_et_spread_retain', [initialSlot]);
      expect(isSpreadDynamicAttrSlot(17, 0)).toBe(true);
      expect(addRef).toHaveBeenCalledTimes(2);
      attachAndComplete([{ uid: 17, ref: TEST_NATIVE_REF }]);
      expect(updateWorkletRef).toHaveBeenCalledExactlyOnceWith(initialObjectRef, TEST_ELEMENT_REF);
      updateWorkletRef.mockClear();

      // Simulate pre-Native prepare followed by Native throwing before updateSpreadAttrSlot runs.
      const rejectedNextSlot = {
        id: 'card-rejected',
        'main-thread:ref': { type: 'main-thread-ref', value: refCb },
      };
      expect(prepareSpreadAttrSlotForNative(null)).toBeNull();
      const preparedForNative = prepareSpreadAttrSlotForNative(rejectedNextSlot);
      expect(preparedForNative).toEqual({
        id: 'card-rejected',
        'has-react-ref': true,
        flatten: false,
      });
      expect(addRef).toHaveBeenLastCalledWith(203, refCb);
      expect(updateWorkletRef).not.toHaveBeenCalled();

      // Initial object ref remains attached and cleans cleanly on teardown.
      deleteMainThreadDynamicAttrStateForSubtree([17]);
      expect(updateWorkletRef).toHaveBeenCalledExactlyOnceWith(initialObjectRef, null);
    } finally {
      restoreRefs();
      restore();
    }
  });

  it('reconciles multi-slot MTRef overrides, key-deletion fallbacks, and JSON.parse sibling updates without disturbing distinct elements', () => {
    const previousRunWorklet = globalThis.runWorklet;
    const { updateWorkletRef, restore } = installRefRuntime();
    const sharedElement = { id: 'shared-el' } as unknown as ElementRef;
    const distinctElement = { id: 'distinct-el' } as unknown as ElementRef;
    vi.mocked(__GetElementByAttrSlot).mockImplementation((_handle, slot) =>
      slot === 3 ? distinctElement : sharedElement
    );

    const directRef = { _wvid: 1 };
    const distinctRef = { _wvid: 99 };
    const spread1Cleanup = vi.fn();
    const spread1Cb = { _wkltId: 'spread1-cb', _execId: 301 };
    const spread2Ref = { _wvid: 2 };
    globalThis.runWorklet = vi.fn(() => spread1Cleanup);

    __etAttrPlanMap._et_multi_mtref = [
      0,
      adaptMTRefAttrSlot,
      1,
      adaptSpreadAttrSlot,
      2,
      adaptSpreadAttrSlot,
      3,
      adaptSpreadAttrSlot,
    ];

    try {
      initializeMainThreadDynamicAttrSlots(21, '_et_multi_mtref', [
        { type: 'main-thread-ref', value: directRef },
        { id: 's1', 'main-thread:ref': { type: 'main-thread-ref', value: spread1Cb } },
        { id: 's2', 'main-thread:ref': { type: 'main-thread-ref', value: spread2Ref } },
        { id: 's3', 'main-thread:ref': { type: 'main-thread-ref', value: distinctRef } },
      ]);
      attachAndComplete([{ uid: 21, ref: TEST_NATIVE_REF }]);

      // Slot 2 overrides slots 0 & 1 on sharedElement; slot 3 attaches independently on distinctElement.
      expect(updateWorkletRef.mock.calls).toEqual([
        [spread2Ref, sharedElement],
        [distinctRef, distinctElement],
      ]);
      expect(globalThis.runWorklet).not.toHaveBeenCalled();
      updateWorkletRef.mockClear();

      // Explicit null in slot 2 ({ 'main-thread:ref': undefined }) detaches sharedElement without falling back.
      updateSpreadAttrSlot(21, 2, { id: 's2', 'main-thread:ref': null }, TEST_NATIVE_REF);
      completeRefAttachments();
      expect(updateWorkletRef.mock.calls).toEqual([[spread2Ref, null]]);
      expect(globalThis.runWorklet).not.toHaveBeenCalled();
      updateWorkletRef.mockClear();

      // Omitting 'main-thread:ref' from slot 2 falls back to slot 1's callback ref.
      updateSpreadAttrSlot(21, 2, { id: 's2-no-ref' }, TEST_NATIVE_REF);
      completeRefAttachments();
      expect(globalThis.runWorklet).toHaveBeenCalledExactlyOnceWith(spread1Cb, [{ elementRefptr: sharedElement }]);
      expect(spread1Cleanup).not.toHaveBeenCalled();
      vi.mocked(globalThis.runWorklet).mockClear();

      // Sibling update in slot 1 arriving as a fresh JSON.parse clone with the same _execId does NOT remount spread1Cb.
      const jsonParsedSameCbClone = JSON.parse(JSON.stringify({
        id: 's1-updated',
        'main-thread:ref': { type: 'main-thread-ref', value: { _wkltId: 'spread1-cb', _execId: 301 } },
      }));
      updateSpreadAttrSlot(21, 1, jsonParsedSameCbClone, TEST_NATIVE_REF);
      completeRefAttachments();
      expect(spread1Cleanup).not.toHaveBeenCalled();
      expect(globalThis.runWorklet).not.toHaveBeenCalled();

      // Clearing slot 1 entirely runs spread1Cleanup synchronously and falls back to direct slot 0!
      updateSpreadAttrSlot(21, 1, null, TEST_NATIVE_REF);
      expect(spread1Cleanup).toHaveBeenCalledTimes(1);
      completeRefAttachments();
      expect(updateWorkletRef.mock.calls).toEqual([[directRef, sharedElement]]);
      updateWorkletRef.mockClear();

      // Subtree deletion cleans both sharedElement (directRef) and distinctElement (distinctRef).
      deleteMainThreadDynamicAttrStateForSubtree([21]);
      expect(updateWorkletRef.mock.calls).toEqual(expect.arrayContaining([
        [directRef, null],
        [distinctRef, null],
      ]));
      expect(updateWorkletRef).toHaveBeenCalledTimes(2);
      expect(spread1Cleanup).toHaveBeenCalledTimes(1);

      // Masking an attached callback ref via a later spread's explicit null cleans it once
      // and does not re-run cleanup on subtree deletion.
      const maskedCleanup = vi.fn();
      const maskedCb = { _wkltId: 'masked-cb', _execId: 302 };
      globalThis.runWorklet = vi.fn(() => maskedCleanup);
      __etAttrPlanMap._et_masked_destroy = [0, adaptSpreadAttrSlot, 1, adaptSpreadAttrSlot];
      initializeMainThreadDynamicAttrSlots(77, '_et_masked_destroy', [
        { 'main-thread:ref': { type: 'main-thread-ref', value: maskedCb } },
        {},
      ]);
      attachAndComplete([{ uid: 77, ref: TEST_NATIVE_REF }]);
      expect(maskedCleanup).toHaveBeenCalledTimes(0);

      updateSpreadAttrSlot(77, 1, { 'main-thread:ref': null }, TEST_NATIVE_REF);
      completeRefAttachments();
      expect(maskedCleanup).toHaveBeenCalledTimes(1);

      deleteMainThreadDynamicAttrStateForSubtree([77]);
      expect(maskedCleanup).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.runWorklet = previousRunWorklet;
      restore();
    }
  });
});
