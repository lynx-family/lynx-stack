// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkletEvents } from '../../src/worklet-runtime/bindings/events.js';
import { disposeWorkletRuntime, resetWorkletRuntimeForReload } from '../../src/worklet-runtime/bindings/lifecycle.js';
import { onHydrationFinished } from '../../src/worklet-runtime/bindings/observers.js';
import {
  getFromWorkletRefMap,
  isHydratedWorkletValue,
  updateWorkletRefInitValueChanges,
} from '../../src/worklet-runtime/workletRef.js';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime.js';

describe('worklet-runtime lifecycle contract', () => {
  let originalLynx;
  let originalSystemInfo;
  let originalSetTimeout;
  let originalSetInterval;
  let originalClearTimeout;
  let originalClearInterval;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    originalLynx = globalThis.lynx;
    originalSystemInfo = globalThis.SystemInfo;
    originalSetTimeout = globalThis.setTimeout;
    originalSetInterval = globalThis.setInterval;
    originalClearTimeout = globalThis.clearTimeout;
    originalClearInterval = globalThis.clearInterval;
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    globalThis.SystemInfo = { lynxSdkVersion: '2.16' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.lynxWorkletImpl?._jsFunctionLifecycleManager?.dispose?.();
    delete globalThis.lynxWorkletImpl;
    delete globalThis.registerWorklet;
    delete globalThis.registerWorkletInternal;
    delete globalThis.runWorklet;
    globalThis.lynx = originalLynx;
    globalThis.SystemInfo = originalSystemInfo;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.clearInterval = originalClearInterval;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('no-ops cleanly when lynxWorkletImpl is not initialized', () => {
    delete globalThis.lynxWorkletImpl;

    expect(() => resetWorkletRuntimeForReload()).not.toThrow();
    expect(() => disposeWorkletRuntime()).not.toThrow();
  });

  it('handles partial runtime mocks safely for reload and dispose', () => {
    globalThis.lynxWorkletImpl = {};
    expect(() => resetWorkletRuntimeForReload()).not.toThrow();
    expect(() => disposeWorkletRuntime()).not.toThrow();
    expect('_jsFunctionLifecycleManager' in globalThis.lynxWorkletImpl).toBe(false);

    globalThis.lynxWorkletImpl = {
      _jsFunctionLifecycleManager: { addRef: vi.fn() },
    };
    expect(() => resetWorkletRuntimeForReload()).not.toThrow();
    expect(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager).toBeDefined();

    expect(() => disposeWorkletRuntime()).not.toThrow();
    expect(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager).toBeUndefined();
  });

  it('resets aborted first-screen state on reload while preserving VM registrations and positive refs', () => {
    const dispatchEvent = vi.fn();
    globalThis.lynx = {
      ...originalLynx,
      getJSContext: () => ({ dispatchEvent }),
    };
    initWorklet();

    const lazyWorklet = vi.fn(() => 'from-lazy');
    globalThis.registerWorklet('main-thread', 'lazy-worklet', lazyWorklet);
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/lazy-object',
      value => ({ value }),
    );
    updateWorkletRefInitValueChanges([[1, 'live-positive', '@test/lazy-object']]);
    const positiveObj = getFromWorkletRefMap({ _wvid: 1 });
    const firstScreenRef = getFromWorkletRefMap({ _wvid: -1, _initValue: 'aborted-first-screen' });
    const delayedTask = vi.fn();
    const firstScreenHandle = { _isFirstScreen: true };
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(firstScreenHandle, delayedTask);
    globalThis.lynxWorkletImpl._eventDelayImpl.delayExecUntilJsReady('legacy-event', [{ currentTarget: {} }]);

    const previousManager = globalThis.lynxWorkletImpl._jsFunctionLifecycleManager;
    previousManager.addRef(5, {});

    resetWorkletRuntimeForReload();

    const nextManager = globalThis.lynxWorkletImpl._jsFunctionLifecycleManager;
    expect(nextManager).toBeDefined();
    expect(nextManager).not.toBe(previousManager);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.epoch).toBe(1);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(0);
    expect(firstScreenHandle).not.toHaveProperty('_delayIndices');
    expect(globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap).toEqual({});
    expect(globalThis.lynxWorkletImpl._eventDelayImpl._delayedWorkletParamsMap.size).toBe(0);

    // VM-scoped registrations and positive-ID refs survive reload.
    expect(globalThis.runWorklet({ _wkltId: 'lazy-worklet' }, [])).toBe('from-lazy');
    expect(getFromWorkletRefMap({ _wvid: 1 })).toBe(positiveObj);
    expect(isHydratedWorkletValue(positiveObj)).toBe(true);
    // Re-allocating negative ID -1 produces a fresh ref instead of returning the aborted one.
    const nextFirstScreenRef = getFromWorkletRefMap({ _wvid: -1, _initValue: 'reloaded-first-screen' });
    expect(nextFirstScreenRef).not.toBe(firstScreenRef);
    expect(nextFirstScreenRef.current).toBe('reloaded-first-screen');

    // Retired manager finalizers cannot release reused execId 5 on the new page.
    nextManager.addRef(5, {});
    previousManager.removeRef(5);
    previousManager.fire();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('disposes lifecycle manager without allocating a replacement on terminal teardown', () => {
    const dispatchEvent = vi.fn();
    globalThis.lynx = {
      ...originalLynx,
      getJSContext: () => ({ dispatchEvent }),
    };
    initWorklet();

    const previousManager = globalThis.lynxWorkletImpl._jsFunctionLifecycleManager;
    previousManager.addRef(7, {});
    getFromWorkletRefMap({ _wvid: -1, _initValue: 'first-screen' });
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground({ _isFirstScreen: true }, vi.fn());
    globalThis.lynxWorkletImpl._eventDelayImpl.delayExecUntilJsReady('legacy-event', [{}]);

    disposeWorkletRuntime();

    expect(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager).toBeUndefined();
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(0);
    expect(globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap).toEqual({});
    expect(globalThis.lynxWorkletImpl._eventDelayImpl._delayedWorkletParamsMap.size).toBe(0);

    previousManager.removeRef(7);
    previousManager.fire();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('invalidates scheduled legacy worklet replays on reload and dispose without breaking hydration replay', () => {
    vi.useFakeTimers();
    try {
      initWorklet();
      const handler = vi.fn();
      globalThis.registerWorklet('main-thread', 'legacy-tap', handler);
      const element = {};
      const worklet = { _wkltId: 'legacy-tap' };
      const makeEvent = () => ({ currentTarget: { elementRefptr: element } });

      // Normal hydration finish clears unmatched entries but preserves scheduled replay.
      globalThis.runWorklet({ _lepusWorkletHash: 'legacy-tap' }, [makeEvent(), 'hydrated']);
      globalThis.lynxWorkletImpl._eventDelayImpl.runDelayedWorklet(worklet, element);
      onHydrationFinished();
      vi.runAllTimers();
      expect(handler).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'hydrated');

      // Reload invalidates already-scheduled replay.
      handler.mockClear();
      globalThis.runWorklet({ _lepusWorkletHash: 'legacy-tap' }, [makeEvent(), 'stale-reload']);
      globalThis.lynxWorkletImpl._eventDelayImpl.runDelayedWorklet(worklet, element);
      expect(vi.getTimerCount()).toBe(1);
      resetWorkletRuntimeForReload();
      vi.runAllTimers();
      expect(handler).not.toHaveBeenCalled();

      // Terminal dispose invalidates already-scheduled replay.
      globalThis.runWorklet({ _lepusWorkletHash: 'legacy-tap' }, [makeEvent(), 'stale-dispose']);
      globalThis.lynxWorkletImpl._eventDelayImpl.runDelayedWorklet(worklet, element);
      expect(vi.getTimerCount()).toBe(1);
      disposeWorkletRuntime();
      vi.runAllTimers();
      expect(handler).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves lazy registrations, allows factory refresh, and avoids duplicate listeners across entry re-evaluations', async () => {
    const listeners = new Map();
    const jsContext = {
      addEventListener: vi.fn((type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      }),
      dispatchEvent: vi.fn(),
    };
    globalThis.lynx = {
      ...originalLynx,
      getJSContext: () => jsContext,
      setTimeout: originalSetTimeout,
      setInterval: originalSetInterval,
      clearTimeout: originalClearTimeout,
      clearInterval: originalClearInterval,
      requestAnimationFrame: originalRequestAnimationFrame,
      cancelAnimationFrame: originalCancelAnimationFrame,
    };

    vi.resetModules();
    const initialEntry = await import('@lynx-js/react/worklet-runtime/init');
    expect(listeners.get(WorkletEvents.runWorkletCtx)).toHaveLength(1);
    expect(listeners.get(WorkletEvents.releaseWorkletRef)).toHaveLength(1);

    // Simulate a lazy bundle registering a worklet and MainThreadObject type once.
    const lazyWorklet = vi.fn(() => 'lazy-ok');
    initialEntry.registerWorklet('main-thread', 'lazy-bundle-fn', lazyWorklet);
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/lazy-type',
      value => ({ source: 'lazy', value }),
    );
    // Simulate a main-entry module registering a MainThreadObject type bound to module-local state.
    const makeEntryFactory = (epoch) => value => ({ epoch, value });
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/entry-type',
      makeEntryFactory(1),
    );
    updateWorkletRefInitValueChanges([[1, 'before', '@test/entry-type']]);
    const realizedBefore = getFromWorkletRefMap({ _wvid: 1 });
    expect(realizedBefore).toEqual({ epoch: 1, value: 'before' });

    // Perform two consecutive reload + entry re-evaluation cycles.
    for (const nextEpoch of [2, 3]) {
      const retiredManager = globalThis.lynxWorkletImpl._jsFunctionLifecycleManager;
      retiredManager.addRef(1, {});
      resetWorkletRuntimeForReload();

      vi.resetModules();
      const reEvaluatedEntry = await import('@lynx-js/react/worklet-runtime/init');
      expect(reEvaluatedEntry.registerWorklet).toBe(globalThis.registerWorkletInternal);

      // Re-evaluated main-entry module refreshes its factory with identical source identity.
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/entry-type',
        makeEntryFactory(nextEpoch),
      );

      // Listeners must not be duplicated on repeated entry re-evaluations, and delivery still works.
      expect(listeners.get(WorkletEvents.runWorkletCtx)).toHaveLength(1);
      expect(listeners.get(WorkletEvents.releaseWorkletRef)).toHaveLength(1);
      lazyWorklet.mockClear();
      listeners.get(WorkletEvents.runWorkletCtx)[0]({
        data: JSON.stringify({
          worklet: { _wkltId: 'lazy-bundle-fn' },
          params: [],
          resolveId: nextEpoch,
        }),
      });
      expect(lazyWorklet).toHaveBeenCalledOnce();

      // Lifecycle manager was recreated cleanly and retired finalizers are inert.
      jsContext.dispatchEvent.mockClear();
      const activeManager = globalThis.lynxWorkletImpl._jsFunctionLifecycleManager;
      expect(activeManager).toBeDefined();
      expect(activeManager).not.toBe(retiredManager);
      retiredManager.removeRef(1);
      retiredManager.fire();
      expect(jsContext.dispatchEvent).not.toHaveBeenCalled();

      // Cached lazy bundle registrations & existing object brands still work.
      expect(globalThis.runWorklet({ _wkltId: 'lazy-bundle-fn' }, [])).toBe('lazy-ok');
      updateWorkletRefInitValueChanges([
        [nextEpoch * 10, `lazy-${nextEpoch}`, '@test/lazy-type'],
        [nextEpoch * 10 + 1, `entry-${nextEpoch}`, '@test/entry-type'],
      ]);
      expect(getFromWorkletRefMap({ _wvid: nextEpoch * 10 })).toEqual({
        source: 'lazy',
        value: `lazy-${nextEpoch}`,
      });
      expect(getFromWorkletRefMap({ _wvid: nextEpoch * 10 + 1 })).toEqual({
        epoch: nextEpoch,
        value: `entry-${nextEpoch}`,
      });
      // Existing realized object keeps its brand across entry re-evaluations.
      expect(() => updateWorkletRefInitValueChanges([[1, 'mismatch', 'main-thread']])).toThrow(
        'Worklet value kind mismatch',
      );
      updateWorkletRefInitValueChanges([[1, 'same', '@test/entry-type']]);
      expect(getFromWorkletRefMap({ _wvid: 1 })).toBe(realizedBefore);
    }
  });
});
