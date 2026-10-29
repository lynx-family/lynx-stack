// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareAttributeSlots } from '../../../../src/element-template/background/attr-slots.js';
import type { GestureSlotValue } from '../../../../src/element-template/prop-adapters/gesture.js';
import {
  hydrateGestureCallbacks,
  prepareGestureForNative,
} from '../../../../src/element-template/prop-adapters/gesture.js';
import {
  __etAttrPlanMap,
  adaptGestureAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import type { MTEventCtx } from '../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import { resetElementTemplateBackgroundFunctionRuntime } from '../../../../src/element-template/runtime/template/main-thread-background-function.js';
import {
  clearMainThreadDynamicAttrState,
  deleteMainThreadDynamicAttrStateForSubtree,
  initializeMainThreadDynamicAttrSlots,
  updateGestureAttrSlot,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';

function gesture(id: number, type: number, callbacks: Record<string, MTEventCtx> = { onBegin: { _wkltId: 'begin' } }) {
  return { __isGesture: true, id, type, config: { enabled: true }, callbacks };
}

function slot(...gestures: ReturnType<typeof gesture>[]) {
  return prepareGestureForNative({ __isGesture: true, type: -1, gestures })!;
}

function installHydrationObserver() {
  const previous = globalThis.lynxWorkletImpl;
  const hydrate = vi.fn();
  globalThis.lynxWorkletImpl = { ...previous, _hydrateCtx: hydrate };
  return { hydrate, restore: () => globalThis.lynxWorkletImpl = previous };
}

afterEach(() => {
  globalThis.__JS__ = true;
  globalThis.__LEPUS__ = false;
  globalThis.__BACKGROUND__ = true;
  globalThis.__MAIN_THREAD__ = false;
  clearMainThreadDynamicAttrState();
  clearEtAttrPlanMap();
  resetElementTemplateBackgroundFunctionRuntime();
});

describe('ET direct Gesture preparation', () => {
  it('flattens nested composition once per detector and preserves its relationships', () => {
    const pan = {
      ...gesture(10, 0),
      waitFor: [{ id: 11 }],
      simultaneousWith: [{ id: 12 }],
      continueWith: [{ id: 13 }],
    };
    const tap = gesture(11, 1);
    const prepared = prepareGestureForNative({
      __isGesture: true,
      type: -1,
      gestures: [pan, { type: -1, gestures: [tap, pan] }],
    })!;

    expect(prepared.type).toBe('gesture');
    expect(prepared.value.map(item => item.id)).toEqual([10, 11]);
    expect(prepared.value[0]).toMatchObject({
      type: 0,
      config: { enabled: true },
      relationMap: { waitFor: [11], simultaneous: [12], continueWith: [13] },
      callbacks: [{ name: 'onBegin', callback: { _wkltId: 'begin' } }],
    });
    expect(prepared.value[0]!.config).not.toBe(pan.config);
    expect(prepared.value[0]!.callbacks[0]!.callback).not.toBe(pan.callbacks.onBegin);
    expect(pan.callbacks.onBegin).toEqual({ _wkltId: 'begin' });
  });

  it.each([null, undefined, false])('clears an absent Gesture (%s)', value => {
    expect(adaptGestureAttrSlot(-1, 0, value)).toBeNull();
  });

  it.each([true, 'pan', {}, { __isGesture: false }])('rejects an invalid public Gesture value (%j)', value => {
    expect(() => prepareGestureForNative(value)).toThrow(
      'ElementTemplate main-thread:gesture expects a Gesture object.',
    );
  });

  it('omits unset callbacks from a serialized Gesture descriptor', () => {
    const prepared = prepareGestureForNative({
      __isSerialized: true,
      id: 1,
      type: 0,
      callbacks: { onBegin: null, onEnd: undefined },
    });
    expect(prepared).toMatchObject({ value: [{ config: {}, callbacks: [] }] });
  });

  it('rejects ordinary callbacks before passing an unusable detector to Native', () => {
    expect(() =>
      prepareGestureForNative({
        ...gesture(1, 0),
        callbacks: { onBegin: () => {} },
      })
    ).toThrow('Gesture callback \'onBegin\' must be a main-thread function.');
  });

  it('reuses delivered callback contexts during repeated preparation while observing mutable configuration', () => {
    const previousFlags = {
      js: globalThis.__JS__,
      lepus: globalThis.__LEPUS__,
      background: globalThis.__BACKGROUND__,
      main: globalThis.__MAIN_THREAD__,
    };
    const previousSdk = SystemInfo.lynxSdkVersion;
    globalThis.__JS__ = true;
    globalThis.__LEPUS__ = false;
    globalThis.__BACKGROUND__ = true;
    globalThis.__MAIN_THREAD__ = false;
    SystemInfo.lynxSdkVersion = '4.0';
    __etAttrPlanMap.gesture = [0, adaptGestureAttrSlot];
    const raw = { ...gesture(1, 0), waitFor: [{ id: 2 }] };
    const rawSlots = [raw];
    try {
      const initial = prepareAttributeSlots('gesture', 17, rawSlots);
      const first = (initial[0] as unknown as GestureSlotValue).value[0]!;
      const firstCallback = first.callbacks[0]!.callback;
      expect(firstCallback._execId).toEqual(expect.any(Number));
      const hydration = prepareAttributeSlots('gesture', 17, rawSlots, {
        previousPreparedSlots: initial,
        previousRawSlots: rawSlots,
      });
      expect((hydration[0] as unknown as GestureSlotValue).value[0]!.callbacks[0]!.callback).toBe(firstCallback);
      raw.config.enabled = false;
      raw.waitFor.push({ id: 3 });
      const create = prepareAttributeSlots('gesture', 17, rawSlots, {
        previousPreparedSlots: hydration,
        previousRawSlots: rawSlots,
      });
      const created = (create[0] as unknown as GestureSlotValue).value[0]!;
      expect(created.callbacks[0]!.callback).toBe(firstCallback);
      expect(created.callbacks[0]!.callback._execId).toBe(firstCallback._execId);
      expect(created.config.enabled).toBe(false);
      expect(created.relationMap.waitFor).toEqual([2, 3]);
      expect(first.config.enabled).toBe(true);
      expect(first.relationMap.waitFor).toEqual([2]);
      raw.callbacks.onBegin = { _wkltId: 'replacement' };
      const changed = prepareAttributeSlots('gesture', 17, rawSlots, {
        previousPreparedSlots: create,
        previousRawSlots: rawSlots,
      });
      const changedCallback = (changed[0] as unknown as GestureSlotValue).value[0]!.callbacks[0]!.callback;
      expect(changedCallback).not.toBe(firstCallback);
      expect(changedCallback._execId).not.toBe(firstCallback._execId);
      expect(changedCallback._wkltId).toBe('replacement');
      expect(raw.callbacks.onBegin).not.toHaveProperty('_execId');
    } finally {
      globalThis.__JS__ = previousFlags.js;
      globalThis.__LEPUS__ = previousFlags.lepus;
      globalThis.__BACKGROUND__ = previousFlags.background;
      globalThis.__MAIN_THREAD__ = previousFlags.main;
      SystemInfo.lynxSdkVersion = previousSdk;
    }
  });

  it('registers each prepared callback without adding exec IDs to the authored Gesture', () => {
    const previousJs = globalThis.__JS__;
    const previousLepus = globalThis.__LEPUS__;
    const previousBackground = globalThis.__BACKGROUND__;
    const previousMain = globalThis.__MAIN_THREAD__;
    const previousSdk = SystemInfo.lynxSdkVersion;
    globalThis.__JS__ = true;
    globalThis.__LEPUS__ = false;
    globalThis.__BACKGROUND__ = true;
    globalThis.__MAIN_THREAD__ = false;
    SystemInfo.lynxSdkVersion = '4.0';
    const raw = gesture(1, 0, { onBegin: { _wkltId: 'begin' } });
    try {
      const prepared = prepareGestureForNative(raw)!;
      expect(prepared.value[0]!.callbacks[0]!.callback._execId).toEqual(expect.any(Number));
      expect(raw.callbacks.onBegin).not.toHaveProperty('_execId');
    } finally {
      globalThis.__JS__ = previousJs;
      globalThis.__LEPUS__ = previousLepus;
      globalThis.__BACKGROUND__ = previousBackground;
      globalThis.__MAIN_THREAD__ = previousMain;
      SystemInfo.lynxSdkVersion = previousSdk;
    }
  });
});

describe('ET Gesture callback handoff and lifecycle', () => {
  it('does not mistake colliding IDs allocated on different threads for callback identity', () => {
    const previous = slot(gesture(1, 0), gesture(2, 1));
    const next = slot(gesture(2, 0), gesture(3, 1));
    const { hydrate, restore } = installHydrationObserver();
    try {
      hydrateGestureCallbacks(next, previous);
      expect(hydrate.mock.calls).toEqual([
        [next.value[0]!.callbacks[0]!.callback, previous.value[0]!.callbacks[0]!.callback],
        [next.value[1]!.callbacks[0]!.callback, previous.value[1]!.callbacks[0]!.callback],
      ]);
    } finally {
      restore();
    }
  });

  it('pairs reordered gesture types and callback names without moving state between detector kinds', () => {
    const previous = slot(gesture(1, 0), gesture(2, 1));
    const next = slot(gesture(1, 1), gesture(2, 0));
    const { hydrate, restore } = installHydrationObserver();
    try {
      hydrateGestureCallbacks(next, previous);
      expect(hydrate.mock.calls).toEqual([
        [next.value[0]!.callbacks[0]!.callback, previous.value[1]!.callbacks[0]!.callback],
        [next.value[1]!.callbacks[0]!.callback, previous.value[0]!.callbacks[0]!.callback],
      ]);
    } finally {
      restore();
    }
  });

  it('hands off callbacks by name and leaves new callbacks and new detector kinds unhydrated', () => {
    const previous = slot(gesture(1, 0, { onBegin: { _wkltId: 'begin' }, onEnd: { _wkltId: 'end' } }));
    const next = slot(
      gesture(2, 0, { onEnd: { _wkltId: 'end' }, onBegin: { _wkltId: 'begin' }, onUpdate: { _wkltId: 'update' } }),
      gesture(3, 1),
    );
    const { hydrate, restore } = installHydrationObserver();
    try {
      hydrateGestureCallbacks(next, previous);
      expect(hydrate.mock.calls).toEqual([
        [next.value[0]!.callbacks[0]!.callback, previous.value[0]!.callbacks[1]!.callback],
        [next.value[0]!.callbacks[1]!.callback, previous.value[0]!.callbacks[0]!.callback],
      ]);
    } finally {
      restore();
    }
  });

  it('retains all initial native callback contexts and hydrates only the current slot value', () => {
    const previousRuntime = globalThis.lynxWorkletImpl;
    const addRef = vi.fn();
    const hydrate = vi.fn();
    globalThis.lynxWorkletImpl = {
      ...previousRuntime,
      _hydrateCtx: hydrate,
      _jsFunctionLifecycleManager: { addRef },
    } as typeof globalThis.lynxWorkletImpl;
    const first = slot(gesture(1, 0, { onBegin: { _wkltId: 'begin' }, onEnd: { _wkltId: 'end' } }));
    first.value[0]!.callbacks[0]!.callback._execId = 41;
    first.value[0]!.callbacks[1]!.callback._execId = 42;
    const updated = slot(gesture(2, 0));
    const hydrated = slot(gesture(3, 0));
    __etAttrPlanMap.gesture = [0, adaptGestureAttrSlot];
    try {
      initializeMainThreadDynamicAttrSlots(17, 'gesture', [first]);
      expect(addRef).toHaveBeenCalledWith(41, first.value[0]!.callbacks[0]!.callback);
      expect(addRef).toHaveBeenCalledWith(42, first.value[0]!.callbacks[1]!.callback);
      updateGestureAttrSlot(17, 0, updated);
      expect(hydrate).not.toHaveBeenCalled();
      updateGestureAttrSlot(17, 0, hydrated, true);
      expect(hydrate).toHaveBeenCalledWith(
        hydrated.value[0]!.callbacks[0]!.callback,
        updated.value[0]!.callbacks[0]!.callback,
      );
    } finally {
      globalThis.lynxWorkletImpl = previousRuntime;
    }
  });

  it.each(['null', 'subtree', 'runtime'] as const)('drops stale first-screen callback state after %s cleanup', mode => {
    const { hydrate, restore } = installHydrationObserver();
    try {
      updateGestureAttrSlot(17, 0, slot(gesture(1, 0)));
      if (mode === 'null') updateGestureAttrSlot(17, 0, null);
      if (mode === 'subtree') deleteMainThreadDynamicAttrStateForSubtree([17]);
      if (mode === 'runtime') clearMainThreadDynamicAttrState();
      updateGestureAttrSlot(17, 0, slot(gesture(2, 0)), true);
      expect(hydrate).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});
