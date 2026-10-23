// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

beforeEach(() => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
});

afterEach(() => {
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

    globalThis.registerWorklet('main-thread', 'child', function() {});
    globalThis.runWorklet(firstScreenChildCtx, []);

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
    // Unused descriptors remain shared transport data rather than GC owners.
    expect(firstScreenWorklet._jsFn).toEqual({
      _jsFn1: { _isFirstScreen: true },
      _jsFn2: { _isFirstScreen: true },
    });

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
    const delay = globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl;
    const handle = firstScreenWorklet._jsFn._jsFn1;
    expect(delay.delayedBackgroundFunctionArray[0].jsFnHandle).toBe(handle);
    expect(handle).toEqual({ _isFirstScreen: true });
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(delay.delayedBackgroundFunctionArray[0].jsFnHandle).toBe(handle);
    expect(handle).toEqual({ _isFirstScreen: false, _execId: 8, _jsFnId: 1 });

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

  it('replays bound handles in call order and drops calls without a hydration handoff', () => {
    const firstScreen = {
      _wkltId: 'ctx1',
      _jsFn: {
        first: { _isFirstScreen: true },
        unused: { _isFirstScreen: true },
        second: { _isFirstScreen: true },
      },
    };
    const task = vi.fn();
    const delay = globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl;
    globalThis.registerWorklet('main-thread', 'ctx1', function() {
      delay.delayRunOnBackground(this._jsFn.second, task);
      delay.delayRunOnBackground(this._jsFn.unused, task);
      delay.delayRunOnBackground(this._jsFn.first, task);
      delay.delayRunOnBackground(this._jsFn.second, task);
    });
    globalThis.runWorklet(firstScreen, []);
    globalThis.lynxWorkletImpl._hydrateCtx({
      _wkltId: 'ctx1',
      _execId: 8,
      _jsFn: { first: { _jsFnId: 1 }, second: { _jsFnId: 2 } },
    }, firstScreen);
    expect(task).not.toHaveBeenCalled();
    const queue = delay.delayedBackgroundFunctionArray;
    delay.runDelayedBackgroundFunctions();
    expect(task.mock.calls).toEqual([[2, 8], [1, 8], [2, 8]]);
    expect(delay.delayedBackgroundFunctionArray).toEqual([]);
    expect(delay.delayedBackgroundFunctionArray).not.toBe(queue);
    expect(firstScreen._jsFn.unused).toEqual({ _isFirstScreen: true });
  });

  it('does not revive cleared calls when their captured handle later hydrates', () => {
    const firstScreen = { _wkltId: 'ctx1', _jsFn: { callback: { _isFirstScreen: true } } };
    const task = vi.fn();
    const delay = globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl;
    globalThis.registerWorklet('main-thread', 'ctx1', function() {
      delay.delayRunOnBackground(this._jsFn.callback, task);
      return () => this._jsFn.callback;
    });
    const escaped = globalThis.runWorklet(firstScreen, []);
    const queue = delay.delayedBackgroundFunctionArray;
    delay.clearDelayedBackgroundFunctions();
    expect(delay.delayedBackgroundFunctionArray).not.toBe(queue);
    globalThis.lynxWorkletImpl._hydrateCtx({
      _wkltId: 'ctx1',
      _execId: 8,
      _jsFn: { callback: { _jsFnId: 1 } },
    }, firstScreen);
    expect(escaped()).toEqual({ _isFirstScreen: false, _execId: 8, _jsFnId: 1 });
    delay.runDelayedBackgroundFunctions();
    expect(task).not.toHaveBeenCalled();
  });
});
