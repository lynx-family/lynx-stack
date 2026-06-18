// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, rstest } from '@rstest/core';

import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  clearMainThreadDynamicAttrState,
  deleteMainThreadDynamicAttrStateForSubtree,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
  updateMainThreadDynamicAttrSlot,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';

const MT_EVENT_TEMPLATE = '_et_mt_event';

function registerMTEventSlots(handleId: number, ...slotIndexes: number[]): void {
  __etAttrPlanMap[MT_EVENT_TEMPLATE] = slotIndexes.flatMap(slotIndex => [
    slotIndex,
    adaptMTEventAttrSlot,
  ]);
  initializeMainThreadDynamicAttrSlots(handleId, MT_EVENT_TEMPLATE, []);
}

function installJsFunctionLifecycleManager(): {
  addRef: ReturnType<typeof rstest.fn>;
  restore: () => void;
} {
  const previousWorkletImpl = globalThis.lynxWorkletImpl;
  const addRef = rstest.fn();
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

describe('main-thread dynamic attr state', () => {
  afterEach(() => {
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
  });

  it('records native-held MTEvent ctx by handle and slot without storing the wrapper', () => {
    const ctx = { _wkltId: 'tap' };
    const wrapper = { type: 'worklet', value: ctx };
    registerMTEventSlots(17, 3);

    updateMainThreadDynamicAttrSlot(17, 3, wrapper);

    expect(getMainThreadDynamicAttrState(17, 3)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
    expect(getMainThreadDynamicAttrState(17, 3)?.nativeHeldValue).not.toBe(wrapper);
  });

  it('retains native-held MTEvent ctx recorded from initial attribute slots', () => {
    const { addRef, restore } = installJsFunctionLifecycleManager();
    const ctx = { _execId: 99, _wkltId: 'tap' };
    __etAttrPlanMap[MT_EVENT_TEMPLATE] = [0, adaptMTEventAttrSlot];

    try {
      initializeMainThreadDynamicAttrSlots(17, MT_EVENT_TEMPLATE, [{
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
      updateMainThreadDynamicAttrSlot(17, 3, { type: 'worklet', value: ctx });

      expect(addRef).toHaveBeenCalledWith(100, ctx);
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

    updateMainThreadDynamicAttrSlot(17, 0, { type: 'worklet', value: first });
    updateMainThreadDynamicAttrSlot(17, 1, { type: 'worklet', value: second });
    updateMainThreadDynamicAttrSlot(18, 0, { type: 'worklet', value: third });

    expect(getMainThreadDynamicAttrState(17, 0)?.nativeHeldValue).toBe(first);
    expect(getMainThreadDynamicAttrState(17, 1)?.nativeHeldValue).toBe(second);
    expect(getMainThreadDynamicAttrState(18, 0)?.nativeHeldValue).toBe(third);
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

  it('does not record wrapper-shaped values without direct MTEvent attr-plan eligibility', () => {
    updateMainThreadDynamicAttrSlot(17, 0, {
      type: 'worklet',
      value: { _wkltId: 'tap' },
    });

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
  });

  it('deletes previous state when a slot is cleared or replaced by an ordinary value', () => {
    const ctx = { _wkltId: 'tap' };
    registerMTEventSlots(17, 3);

    updateMainThreadDynamicAttrSlot(17, 3, { type: 'worklet', value: ctx });
    updateMainThreadDynamicAttrSlot(17, 3, null);
    expect(getMainThreadDynamicAttrState(17, 3)).toBeUndefined();

    updateMainThreadDynamicAttrSlot(17, 3, { type: 'worklet', value: ctx });
    updateMainThreadDynamicAttrSlot(17, 3, 'plain');
    expect(getMainThreadDynamicAttrState(17, 3)).toBeUndefined();
  });

  it('does not record invalid main-thread event wrappers', () => {
    registerMTEventSlots(17, 0, 1, 2);
    updateMainThreadDynamicAttrSlot(17, 0, {
      type: 'worklet',
      value: {},
    });
    updateMainThreadDynamicAttrSlot(17, 1, {
      type: 'worklet',
      value: { _lepusWorkletHash: 'legacy' },
    });
    updateMainThreadDynamicAttrSlot(17, 2, {
      type: 'worklet',
      value: { _wkltId: 1 },
    });

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 1)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 2)).toBeUndefined();
  });

  it('deletes previous state when an invalid wrapper replaces the slot value', () => {
    registerMTEventSlots(17, 0);
    updateMainThreadDynamicAttrSlot(17, 0, {
      type: 'worklet',
      value: { _wkltId: 'tap' },
    });

    updateMainThreadDynamicAttrSlot(17, 0, {
      type: 'worklet',
      value: {},
    });

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
  });

  it('deletes every state entry owned by removed subtree handles', () => {
    registerMTEventSlots(17, 0, 1);
    registerMTEventSlots(18, 0);
    updateMainThreadDynamicAttrSlot(17, 0, { type: 'worklet', value: { _wkltId: 'a' } });
    updateMainThreadDynamicAttrSlot(17, 1, { type: 'worklet', value: { _wkltId: 'b' } });
    updateMainThreadDynamicAttrSlot(18, 0, { type: 'worklet', value: { _wkltId: 'c' } });

    deleteMainThreadDynamicAttrStateForSubtree([17]);

    expect(getMainThreadDynamicAttrState(17, 0)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 1)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(18, 0)).toBeDefined();
  });

  it('returns an MTEvent hydrate handoff when hydration replaces native-held ctx', () => {
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    registerMTEventSlots(17, 0);
    updateMainThreadDynamicAttrSlot(17, 0, { type: 'worklet', value: oldCtx });

    const handoff = updateMainThreadDynamicAttrSlot(
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
    updateMainThreadDynamicAttrSlot(17, 0, { type: 'worklet', value: oldCtx });

    expect(updateMainThreadDynamicAttrSlot(17, 0, { type: 'worklet', value: nextCtx })).toBeUndefined();
    expect(getMainThreadDynamicAttrState(17, 0)?.nativeHeldValue).toBe(nextCtx);
  });
});
