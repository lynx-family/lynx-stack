// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onHydrationFinished, onWorkletCtxUpdate } from '../../src/worklet-runtime/bindings/observers';
import { updateWorkletRefInitValueChanges } from '../../src/worklet-runtime/workletRef';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

function nestContext(ctx, depth) {
  for (let i = 1; i <= depth; i++) {
    ctx = { _wkltId: `parent-${i}`, _c: { child: ctx } };
  }
  return ctx;
}

beforeEach(() => {
  globalThis.SystemInfo = { lynxSdkVersion: '2.16' };
  initWorklet();
  for (let i = 1; i <= 2; i++) {
    globalThis.registerWorklet('main-thread', `parent-${i}`, function(...args) {
      return this._c.child(...args);
    });
  }
  // Model collection of weak targets deterministically. Hydration must work
  // through the live function even when no weak reference can recover its original context.
  vi.spyOn(globalThis, 'WeakRef').mockImplementation(function() {
    return { deref: () => undefined };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.lynxWorkletImpl;
});

describe.each([0, 1, 2])('hydration at nesting depth %i', (depth) => {
  it('preserves first-screen ref identity and writes across event contexts', () => {
    globalThis.registerWorklet('main-thread', 'write', function(width) {
      this._c.ref.current.width = width;
      return this._c.ref;
    });
    globalThis.registerWorklet('main-thread', 'read', function() {
      return this._c.ref;
    });
    const firstScreen = nestContext({
      _wkltId: 'write',
      _c: { ref: { _wvid: -1, _initValue: { width: 0 } } },
    }, depth);
    const firstScreenRef = globalThis.runWorklet(firstScreen, [240]);
    const background = nestContext({
      _wkltId: 'write',
      _c: { ref: { _wvid: 1 } },
    }, depth);
    background._execId = 8;
    updateWorkletRefInitValueChanges([[1, { width: 0 }]]);

    onWorkletCtxUpdate(background, firstScreen, true, {});
    onHydrationFinished();

    const reader = { _wkltId: 'read', _c: { ref: { _wvid: 1 } } };
    const hydratedRef = globalThis.runWorklet(reader, []);
    expect(hydratedRef).toBe(firstScreenRef);
    expect(hydratedRef.current.width).toBe(240);
    globalThis.runWorklet(background, [480]);
    expect(globalThis.runWorklet(reader, []).current.width).toBe(480);
  });

  it('runs first-screen delayed background calls after hydration', () => {
    const task = vi.fn();
    globalThis.registerWorklet('main-thread', 'call', function() {
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(this._jsFn.callback, task);
    });
    const firstScreen = nestContext({
      _wkltId: 'call',
      _jsFn: { callback: { _isFirstScreen: true } },
    }, depth);
    globalThis.runWorklet(firstScreen, []);
    expect(task).not.toHaveBeenCalled();
    const background = nestContext({
      _wkltId: 'call',
      _jsFn: { callback: { _jsFnId: 3 } },
    }, depth);
    background._execId = 8;

    onWorkletCtxUpdate(background, firstScreen, true, {});
    onHydrationFinished();

    expect(task).toHaveBeenCalledExactlyOnceWith(3, 8);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(0);
  });
});
