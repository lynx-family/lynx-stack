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
  initializeMainThreadDynamicAttrSlots as initializeDynamicAttrSlotsImpl,
  updateMainThreadDynamicAttrSlot as updateDynamicAttrSlotImpl,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';

const MT_EVENT_TEMPLATE = '_et_mt_event';
const MT_REF_TEMPLATE = '_et_mt_ref';
const TEST_NATIVE_REF = { id: 'dynamic-attr-target' } as unknown as ElementRef;

function initializeDynamicAttrSlots(
  handleId: number,
  templateType: string,
  attributeSlots: readonly unknown[] | null | undefined,
  nativeRef: ElementRef = TEST_NATIVE_REF,
  attachMTRefs = false,
): void {
  initializeDynamicAttrSlotsImpl(handleId, templateType, attributeSlots, nativeRef, attachMTRefs);
}

function updateDynamicAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  isHydration = false,
  nativeRef: ElementRef = TEST_NATIVE_REF,
) {
  return updateDynamicAttrSlotImpl(handleId, attrSlotIndex, value, nativeRef, isHydration);
}

function registerMTEventSlots(handleId: number, ...slotIndexes: number[]): void {
  __etAttrPlanMap[MT_EVENT_TEMPLATE] = slotIndexes.flatMap(slotIndex => [
    slotIndex,
    adaptMTEventAttrSlot,
  ]);
  initializeDynamicAttrSlots(handleId, MT_EVENT_TEMPLATE, []);
}

function registerMTRefSlots(handleId: number, ...slotIndexes: number[]): void {
  __etAttrPlanMap[MT_REF_TEMPLATE] = slotIndexes.flatMap(slotIndex => [
    slotIndex,
    adaptMTRefAttrSlot,
  ]);
  initializeDynamicAttrSlots(handleId, MT_REF_TEMPLATE, []);
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

  it('records native-held MTEvent ctx by handle and slot without storing the wrapper', () => {
    const ctx = { _wkltId: 'tap' };
    const wrapper = { type: 'worklet', value: ctx };
    registerMTEventSlots(17, 3);

    updateDynamicAttrSlot(17, 3, wrapper);

    expect(getMainThreadDynamicAttrState(17, 3)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
    expect(getMainThreadDynamicAttrState(17, 3)?.nativeHeldValue).not.toBe(wrapper);
  });

  it('records MTRef values by handle and slot without storing the wrapper', () => {
    const ref = { _wvid: 7 };
    const wrapper = { type: 'main-thread-ref', value: ref };
    registerMTRefSlots(17, 3);

    updateDynamicAttrSlot(17, 3, wrapper);

    expect(getMainThreadDynamicAttrState(17, 3)).toEqual({
      kind: 'mt-ref',
      value: ref,
      attached: false,
    });
    expect(getMainThreadDynamicAttrState(17, 3)).not.toBe(wrapper);
  });

  it('attaches and detaches MTRef values for list-managed subtrees', () => {
    const { updateWorkletRef, restore } = installRefRuntime();
    const nativeRef = { id: 'target' } as unknown as ElementRef;
    const firstRef = { _wvid: 7 };
    const nextRef = { _wvid: 8 };

    try {
      registerMTRefSlots(17, 0);
      updateDynamicAttrSlot(17, 0, { type: 'main-thread-ref', value: firstRef });

      attachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: nativeRef }]);

      expect(updateWorkletRef).toHaveBeenCalledWith(firstRef, nativeRef);
      expect(getMainThreadDynamicAttrState(17, 0)).toEqual({
        kind: 'mt-ref',
        value: firstRef,
        attached: true,
      });

      updateWorkletRef.mockClear();
      detachMainThreadDynamicAttrRefsForSubtree([{ uid: 17, ref: nativeRef }]);

      expect(updateWorkletRef).toHaveBeenCalledWith(firstRef, null);
      expect(getMainThreadDynamicAttrState(17, 0)).toEqual({
        kind: 'mt-ref',
        value: firstRef,
        attached: false,
      });

      updateWorkletRef.mockClear();
      updateDynamicAttrSlot(
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
        attached: true,
      });
    } finally {
      restore();
    }
  });

  it('retains native-held MTEvent ctx recorded from initial attribute slots', () => {
    const { addRef, restore } = installJsFunctionLifecycleManager();
    const ctx = { _execId: 99, _wkltId: 'tap' };
    __etAttrPlanMap[MT_EVENT_TEMPLATE] = [0, adaptMTEventAttrSlot];

    try {
      initializeDynamicAttrSlots(17, MT_EVENT_TEMPLATE, [{
        type: 'worklet',
        value: ctx,
      }]);

      expect(addRef).toHaveBeenCalledWith(99, ctx);
    } finally {
      restore();
    }
  });

  it('retains native-held MTEvent ctx recorded from updates', () => {
    const { addRef, restore } = installJsFunctionLifecycleManager();
    const ctx = { _execId: 100, _wkltId: 'tap' };

    try {
      registerMTEventSlots(17, 3);
      updateDynamicAttrSlot(17, 3, { type: 'worklet', value: ctx });

      expect(addRef).toHaveBeenCalledWith(100, ctx);
    } finally {
      restore();
    }
  });

  it('retains callback MTRef values recorded from updates', () => {
    const { addRef, restore } = installJsFunctionLifecycleManager();
    const callback = { _execId: 101, _wkltId: 'ref-callback' };

    try {
      registerMTRefSlots(17, 3);
      updateDynamicAttrSlot(17, 3, {
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
    registerMTEventSlots(17, 0, 1);
    registerMTEventSlots(18, 0);

    updateDynamicAttrSlot(17, 0, { type: 'worklet', value: first });
    updateDynamicAttrSlot(17, 1, { type: 'worklet', value: second });
    updateDynamicAttrSlot(18, 0, { type: 'worklet', value: third });

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
    initializeDynamicAttrSlots(17, '_et_mixed', []);

    updateDynamicAttrSlot(17, 0, { type: 'worklet', value: ctx });
    updateDynamicAttrSlot(17, 1, { type: 'main-thread-ref', value: ref });

    expect(getMainThreadDynamicAttrState(17, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
    expect(getMainThreadDynamicAttrState(17, 1)).toEqual({
      kind: 'mt-ref',
      value: ref,
      attached: false,
    });
  });

  it('records MTEvent wrappers only for eligible native attribute slots', () => {
    const ctx = { _wkltId: 'tap' };
    __etAttrPlanMap[MT_EVENT_TEMPLATE] = [1, adaptMTEventAttrSlot];

    initializeDynamicAttrSlots(17, MT_EVENT_TEMPLATE, [
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

    initializeDynamicAttrSlots(17, MT_REF_TEMPLATE, [
      { type: 'main-thread-ref', value: { _wvid: 6 } },
      { type: 'main-thread-ref', value: ref },
      'plain',
    ]);

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 1)).toEqual({
      kind: 'mt-ref',
      value: ref,
      attached: false,
    });
    expect(getMainThreadDynamicAttrState(17, 2)).toBeUndefined();
  });

  it('does not record wrapper-shaped values without direct MTEvent attr-plan eligibility', () => {
    updateDynamicAttrSlot(17, 0, {
      type: 'worklet',
      value: { _wkltId: 'tap' },
    });

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
  });

  it('does not record MTRef wrapper-shaped values without direct MTRef attr-plan eligibility', () => {
    updateDynamicAttrSlot(17, 0, {
      type: 'main-thread-ref',
      value: { _wvid: 7 },
    });

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
  });

  it('deletes previous state when a slot is cleared or replaced by an ordinary value', () => {
    const ctx = { _wkltId: 'tap' };
    registerMTEventSlots(17, 3);

    updateDynamicAttrSlot(17, 3, { type: 'worklet', value: ctx });
    updateDynamicAttrSlot(17, 3, null);
    expect(getMainThreadDynamicAttrState(17, 3)).toBeUndefined();

    updateDynamicAttrSlot(17, 3, { type: 'worklet', value: ctx });
    updateDynamicAttrSlot(17, 3, 'plain');
    expect(getMainThreadDynamicAttrState(17, 3)).toBeUndefined();
  });

  it('deletes previous MTRef state when a slot is cleared', () => {
    const ref = { _wvid: 7 };
    registerMTRefSlots(17, 3);

    updateDynamicAttrSlot(17, 3, { type: 'main-thread-ref', value: ref });
    updateDynamicAttrSlot(17, 3, null);
    expect(getMainThreadDynamicAttrState(17, 3)).toBeUndefined();
  });

  it('does not record invalid main-thread event wrappers', () => {
    registerMTEventSlots(17, 0, 1, 2);
    updateDynamicAttrSlot(17, 0, {
      type: 'worklet',
      value: {},
    });
    updateDynamicAttrSlot(17, 1, {
      type: 'worklet',
      value: { _lepusWorkletHash: 'legacy' },
    });
    updateDynamicAttrSlot(17, 2, {
      type: 'worklet',
      value: { _wkltId: 1 },
    });

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 1)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 2)).toBeUndefined();
  });

  it('deletes previous state when an invalid wrapper replaces the slot value', () => {
    registerMTEventSlots(17, 0);
    updateDynamicAttrSlot(17, 0, {
      type: 'worklet',
      value: { _wkltId: 'tap' },
    });

    updateDynamicAttrSlot(17, 0, {
      type: 'worklet',
      value: {},
    });

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
  });

  it('deletes every state entry owned by removed subtree handles', () => {
    registerMTEventSlots(17, 0, 1);
    registerMTEventSlots(18, 0);
    updateDynamicAttrSlot(17, 0, { type: 'worklet', value: { _wkltId: 'a' } });
    updateDynamicAttrSlot(17, 1, { type: 'worklet', value: { _wkltId: 'b' } });
    updateDynamicAttrSlot(18, 0, { type: 'worklet', value: { _wkltId: 'c' } });
    registerMTRefSlots(19, 0);
    updateDynamicAttrSlot(19, 0, { type: 'main-thread-ref', value: { _wvid: 7 } });

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
      updateDynamicAttrSlot(
        17,
        0,
        { type: 'main-thread-ref', value: ref },
        false,
        { id: 'ref-target' } as unknown as ElementRef,
      );
      registerMTRefSlots(18, 0);
      updateDynamicAttrSlot(
        18,
        0,
        { type: 'main-thread-ref', value: callback },
        false,
        { id: 'callback-target' } as unknown as ElementRef,
      );
      attachMainThreadDynamicAttrRefsForSubtree([
        { uid: 17, ref: { id: 'ref-target' } as unknown as ElementRef },
        { uid: 18, ref: { id: 'callback-target' } as unknown as ElementRef },
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
      updateDynamicAttrSlot(
        17,
        0,
        { type: 'main-thread-ref', value: callback },
        false,
        { id: 'callback-target' } as unknown as ElementRef,
      );
      attachMainThreadDynamicAttrRefsForSubtree([
        { uid: 17, ref: { id: 'callback-target' } as unknown as ElementRef },
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
      updateDynamicAttrSlot(
        17,
        0,
        { type: 'main-thread-ref', value: ref },
        false,
        { id: 'target' } as unknown as ElementRef,
      );
      attachMainThreadDynamicAttrRefsForSubtree([
        { uid: 17, ref: { id: 'target' } as unknown as ElementRef },
      ]);

      deleteMainThreadDynamicAttrStateForSubtree([17]);

      expect(updateWorkletRef).toHaveBeenCalledWith(ref, null);
      expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('returns an MTEvent hydrate handoff when hydration replaces native-held ctx', () => {
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    registerMTEventSlots(17, 0);
    updateDynamicAttrSlot(17, 0, { type: 'worklet', value: oldCtx });

    const handoff = updateDynamicAttrSlot(
      17,
      0,
      { type: 'worklet', value: nextCtx },
      true,
    );

    expect(handoff).toEqual({
      kind: 'mt-event',
      nextValue: nextCtx,
      previousNativeHeldValue: oldCtx,
    });
    expect(getMainThreadDynamicAttrState(17, 0)?.nativeHeldValue).toBe(nextCtx);
  });

  it('does not return hydrate handoffs for ordinary updates', () => {
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    registerMTEventSlots(17, 0);
    updateDynamicAttrSlot(17, 0, { type: 'worklet', value: oldCtx });

    expect(updateDynamicAttrSlot(17, 0, { type: 'worklet', value: nextCtx })).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 0)?.nativeHeldValue).toBe(nextCtx);
  });
});
