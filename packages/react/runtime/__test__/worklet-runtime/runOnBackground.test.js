// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearDelayedRunOnBackgroundFunctions } from '../../src/worklet-runtime/bindings/observers';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

const originalLynx = globalThis.lynx;

beforeEach(() => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
});

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.lynx = originalLynx;
  globalThis.lynxWorkletImpl?._jsFunctionLifecycleManager?.dispose();
  delete globalThis.lynxWorkletImpl;
});

describe('runOnBackground', () => {
  it('should expose the bound copy without retaining the original nested context', () => {
    const childCtx = {
      _wkltId: 'child',
    };
    const parentCtx = {
      _wkltId: 'parent',
      child: childCtx,
    };

    globalThis.registerWorklet('main-thread', 'parent', function() {
      return this.child;
    });
    globalThis.registerWorklet('main-thread', 'child', function() {
      return this;
    });

    const childWorklet = globalThis.runWorklet(parentCtx, []);
    expect(childWorklet.boundCtx).toBe(childWorklet());
    expect(childWorklet.boundCtx).not.toBe(childCtx);
    expect(childWorklet).not.toHaveProperty('ctx');
  });

  it('should hydrate nested worklet ctx from its bound context', () => {
    const firstScreenChildCtx = {
      _wkltId: 'child',
      _jsFn: {
        '_jsFn1': { '_isFirstScreen': true },
      },
    };
    const firstScreenWorklet = {
      _wkltId: 'parent',
      child: Object.assign(function() {}, {
        boundCtx: firstScreenChildCtx,
      }),
    };
    const worklet = {
      _wkltId: 'parent',
      child: {
        _wkltId: 'child',
        _jsFn: {
          '_jsFn1': { '_jsFnId': 1 },
        },
      },
      _execId: 8,
    };

    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);

    expect(firstScreenChildCtx._jsFn._jsFn1._isFirstScreen).toBe(false);
    expect(firstScreenChildCtx._jsFn._jsFn1._jsFnId).toBe(1);
    expect(firstScreenChildCtx._jsFn._jsFn1._execId).toBe(8);
  });

  it('should delay and run task', () => {
    const firstScreenWorklet = {
      _wkltId: 'ctx1',
      _jsFn: {
        '_jsFn1': { '_isFirstScreen': true },
        '_jsFn2': { '_isFirstScreen': true },
      },
    };
    const worklet = {
      _wkltId: 'ctx1',
      _jsFn: {
        '_jsFn1': { '_jsFnId': 1 },
        '_jsFn2': { '_jsFnId': 2 },
        '_jsFn3': { '_jsFnId': 3 },
      },
      _execId: 8,
    };
    // If the functions are not used in the first screen, they should not be called
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
        .delayedBackgroundFunctionArray.length,
    ).toBe(0);
    // functions in `firstScreenWorklet` should be hydrated
    expect(firstScreenWorklet._jsFn._jsFn1._isFirstScreen).toBe(false);
    expect(firstScreenWorklet._jsFn._jsFn1._jsFnId).toBe(1);
    expect(firstScreenWorklet._jsFn._jsFn1._execId).toBe(8);
    expect(firstScreenWorklet._jsFn._jsFn2._isFirstScreen).toBe(false);
    expect(firstScreenWorklet._jsFn._jsFn2._jsFnId).toBe(2);
    expect(firstScreenWorklet._jsFn._jsFn2._execId).toBe(8);

    // If the functions are used in the first screen, they will be hydrated
    const task = vi.fn();
    globalThis.registerWorklet('main-thread', 'ctx1', function() {
      const { _jsFn1 } = this._jsFn;
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(
        _jsFn1,
        task,
      );
    });
    globalThis.runWorklet(firstScreenWorklet, []);
    expect(
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
        .delayedBackgroundFunctionArray,
    ).toMatchInlineSnapshot(`
      [
        {
          "task": [MockFunction spy],
        },
      ]
    `);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
        .delayedBackgroundFunctionArray,
    ).toMatchInlineSnapshot(`
      [
        {
          "jsFnHandle": {
            "_execId": 8,
            "_hydratedEpoch": 0,
            "_isFirstScreen": false,
            "_jsFnId": 1,
          },
          "task": [MockFunction spy],
        },
      ]
    `);

    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
      .runDelayedBackgroundFunctions();
    expect(task.mock.calls).toMatchInlineSnapshot(`
      [
        [
          1,
          8,
        ],
      ]
    `);
    expect(
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
        .delayedBackgroundFunctionArray.length,
    ).toBe(0);
  });

  it('should skip stale delayed background entries during hydration', () => {
    const firstScreenWorklet = {
      _wkltId: 'ctx1',
      _jsFn: {
        '_jsFn1': { '_isFirstScreen': true, _delayIndices: [0, 1] },
      },
    };
    const worklet = {
      _wkltId: 'ctx1',
      _jsFn: {
        '_jsFn1': { '_jsFnId': 1 },
      },
      _execId: 8,
    };
    const task = vi.fn();
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
      .delayedBackgroundFunctionArray[1] = { task };

    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);

    expect(
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
        .delayedBackgroundFunctionArray[1],
    ).toMatchObject({
      jsFnHandle: {
        _execId: 8,
        _jsFnId: 1,
      },
      task,
    });
    expect(task).not.toHaveBeenCalled();
  });

  it('transitions queued first-screen handles for subsequent calls and retains ownership until collected', async () => {
    const releasedExecIds = [];
    globalThis.lynx = {
      getJSContext: () => ({
        dispatchEvent: (event) => {
          if (event.type === 'Lynx.Worklet.releaseBackgroundWorkletCtx') {
            releasedExecIds.push(...event.data);
          }
        },
      }),
    };

    const registered = [];
    vi.spyOn(globalThis, 'FinalizationRegistry').mockImplementation(function(cleanup) {
      return {
        register(target, heldValue) {
          registered.push({ target, heldValue, cleanup, finalized: false });
        },
      };
    });
    initWorklet();

    function finalizeExcept(liveTargets) {
      const live = new Set(liveTargets);
      for (const entry of registered) {
        if (!entry.finalized && !live.has(entry.target)) {
          entry.finalized = true;
          entry.cleanup(entry.heldValue);
        }
      }
    }

    // Mode A (queued before hydration) & Mode B (first called after hydration) on the same retained closure
    let tick;
    globalThis.registerWorklet('main-thread', 'timer-ref', function(element) {
      if (!element || this._c.started.current) return;
      this._c.started.current = true;
      const { onQueued, onPostHydrate } = this._jsFn;
      tick = (mode, value) => {
        const handle = mode === 'queued' ? onQueued : onPostHydrate;
        if (handle._isFirstScreen) {
          globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(
            handle,
            (fnId, execId) => dispatched.push({ mode, value, fnId, execId }),
          );
          return;
        }
        dispatched.push({ mode, value, fnId: handle._jsFnId, execId: handle._execId });
      };
      tick('queued', 1);
      tick('queued', 2);
    });

    const dispatched = [];
    let activeSlot = {
      _wkltId: 'timer-ref',
      _c: { started: { _wvid: -1, _initValue: false, _type: 'main-thread' } },
      _jsFn: {
        onQueued: { _isFirstScreen: true },
        onPostHydrate: { _isFirstScreen: true },
      },
    };
    const retainedQueuedHandle = activeSlot._jsFn.onQueued;
    const retainedPostHandle = activeSlot._jsFn.onPostHydrate;
    globalThis.runWorklet(activeSlot, [{ elementRefptr: {} }]);
    expect(dispatched).toEqual([]);
    expect(retainedQueuedHandle._delayIndices).toEqual([0, 1]);

    // Hydrate with execId = 10
    globalThis.lynxWorkletImpl._refImpl.updateWorkletRefInitValueChanges([[1, false, 'main-thread']]);
    const hydratedSlot = {
      _wkltId: 'timer-ref',
      _execId: 10,
      _c: { started: { _wvid: 1, _type: 'main-thread' } },
      _jsFn: { onQueued: { _jsFnId: 1 }, onPostHydrate: { _jsFnId: 2 } },
    };
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager.addRef(10, hydratedSlot);
    globalThis.lynxWorkletImpl._hydrateCtx(hydratedSlot, activeSlot);
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.runDelayedBackgroundFunctions();
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(0);
    activeSlot = hydratedSlot;
    globalThis.runWorklet(activeSlot, [{ elementRefptr: {} }]);

    expect(dispatched).toEqual([
      { mode: 'queued', value: 1, fnId: 1, execId: 10 },
      { mode: 'queued', value: 2, fnId: 1, execId: 10 },
    ]);
    expect(retainedQueuedHandle).not.toHaveProperty('_delayIndices');
    expect(retainedQueuedHandle).toMatchObject({ _isFirstScreen: false, _hydratedEpoch: 0, _jsFnId: 1, _execId: 10 });
    expect(retainedPostHandle).toMatchObject({ _isFirstScreen: false, _hydratedEpoch: 0, _jsFnId: 2, _execId: 10 });

    // Rerender replaces slot with execId = 11, then MTS GC collects hydratedSlot while `tick` stays alive
    const rerenderSlot = {
      _wkltId: 'timer-ref',
      _execId: 11,
      _c: { started: { _wvid: 1, _type: 'main-thread' } },
      _jsFn: { onQueued: { _jsFnId: 3 }, onPostHydrate: { _jsFnId: 4 } },
    };
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager.addRef(11, rerenderSlot);
    activeSlot = rerenderSlot;
    globalThis.runWorklet(activeSlot, [{ elementRefptr: {} }]);

    finalizeExcept([activeSlot, retainedQueuedHandle, retainedPostHandle]);
    await Promise.resolve();
    expect(releasedExecIds).toEqual([]);

    // Post-hydration calls on both handles dispatch directly without re-entering delay queue
    tick('queued', 3);
    tick('post', 4);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(0);
    expect(dispatched.slice(2)).toEqual([
      { mode: 'queued', value: 3, fnId: 1, execId: 10 },
      { mode: 'post', value: 4, fnId: 2, execId: 10 },
    ]);

    // Cancel timer and unmount slot: both execId 10 and 11 must now be released
    tick = undefined;
    activeSlot = undefined;
    finalizeExcept([]);
    await Promise.resolve();
    expect(releasedExecIds.sort((a, b) => a - b)).toEqual([10, 11]);
  });

  it('binds a shared first-screen handle once per epoch, rebinds on reload, and ignores orphaned delays', () => {
    const sharedHandle = { _isFirstScreen: true };
    const nonFirstScreenHandle = { _jsFnId: 9, _execId: 4 };
    const sharedFirstScreen = {
      _wkltId: 'shared',
      _jsFn: { cb: sharedHandle, existing: nonFirstScreenHandle },
    };
    const slotA = { _wkltId: 'shared', _execId: 21, _jsFn: { cb: { _jsFnId: 5 }, existing: { _jsFnId: 9 } } };
    const slotB = { _wkltId: 'shared', _execId: 22, _jsFn: { cb: { _jsFnId: 5 } } };

    globalThis.lynxWorkletImpl._hydrateCtx(slotA, sharedFirstScreen);
    globalThis.lynxWorkletImpl._hydrateCtx(slotB, sharedFirstScreen);

    expect(sharedHandle).toMatchObject({ _isFirstScreen: false, _hydratedEpoch: 0, _jsFnId: 5, _execId: 21 });
    expect(nonFirstScreenHandle).toEqual({ _jsFnId: 9, _execId: 4 });
    expect(slotB._jsFn.cb._execId).toBe(22);
    expect(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager.execIdRefCount.get(21)).toBe(1);
    expect(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager.execIdRefCount.get(22)).toBeUndefined();

    // Once hydration finishes, an orphaned unhydrated first-screen handle does not grow the delay queue
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.runDelayedBackgroundFunctions();
    const orphan = { _isFirstScreen: true };
    const orphanTask = vi.fn();
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(orphan, orphanTask);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(0);
    expect(orphan).not.toHaveProperty('_delayIndices');

    // Reload recreates the lifecycle manager, clears stale _delayIndices, advances epoch, and rebinds handles
    const epoch0Manager = globalThis.lynxWorkletImpl._jsFunctionLifecycleManager;
    clearDelayedRunOnBackgroundFunctions();
    expect(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager).not.toBe(epoch0Manager);
    const staleTask = vi.fn();
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(sharedHandle, staleTask);
    expect(sharedHandle._delayIndices).toEqual([0]);

    // Aborting pre-hydration via another reload must clear sharedHandle._delayIndices so it cannot overwrite index 0
    clearDelayedRunOnBackgroundFunctions();
    expect(sharedHandle).not.toHaveProperty('_delayIndices');
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(orphan, orphanTask);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(1);

    const epoch2Slot = {
      _wkltId: 'shared',
      _execId: 30,
      _jsFn: { cb: { _jsFnId: 6 }, orphan: { _jsFnId: 7 } },
    };
    globalThis.lynxWorkletImpl._hydrateCtx(epoch2Slot, {
      _wkltId: 'shared',
      _jsFn: { cb: sharedHandle, orphan },
    });
    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.runDelayedBackgroundFunctions();
    expect(staleTask).not.toHaveBeenCalled();
    expect(orphanTask).toHaveBeenCalledExactlyOnceWith(7, 30);
    expect(sharedHandle).toMatchObject({ _isFirstScreen: false, _hydratedEpoch: 2, _jsFnId: 6, _execId: 30 });
    expect(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager.execIdRefCount.get(30)).toBe(2);
  });
});
