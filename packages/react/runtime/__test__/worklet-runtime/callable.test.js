// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initApiEnv } from '../../src/worklet-runtime/api/lynxApi';
import { updateCallableCtxChanges } from '../../src/worklet-runtime/callable';
import { initEventListeners } from '../../src/worklet-runtime/listeners';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

describe('main-thread callable transport', () => {
  beforeEach(() => {
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.16',
    };
    delete globalThis.lynxWorkletImpl;
    globalThis.lynx = {
      requestAnimationFrame: vi.fn(),
    };
    initApiEnv();
  });

  it('should hydrate a captured handle to a callable function', () => {
    initWorklet();

    const ease = vi.fn((progress) => progress * 2);
    globalThis.registerWorklet('main-thread', 'ease', function(progress) {
      return ease(progress);
    });
    updateCallableCtxChanges([[1, { _wkltId: 'ease' }]]);

    const consumer = vi.fn(function() {
      const { callable } = this._c;
      expect(typeof callable).toBe('function');
      expect(callable(0.5)).toBe(1);
    });
    globalThis.registerWorklet('main-thread', 'consumer', consumer);

    globalThis.runWorklet({
      _wkltId: 'consumer',
      _c: {
        callable: { _wcid: 1 },
      },
    });
    expect(consumer).toBeCalled();
    expect(ease).toBeCalledWith(0.5);
  });

  it('should hydrate handles nested in arrays and pass parameters', () => {
    initWorklet();

    const calls = [];
    globalThis.registerWorklet('main-thread', 'easeA', function(p) {
      calls.push(['a', p, this._c.offset]);
      return p + this._c.offset;
    });
    globalThis.registerWorklet('main-thread', 'easeB', (p) => {
      calls.push(['b', p]);
      return p;
    });
    updateCallableCtxChanges([
      [1, { _wkltId: 'easeA', _c: { offset: 10 } }],
      [2, { _wkltId: 'easeB' }],
    ]);

    const consumer = vi.fn(function(options) {
      const [first, second] = options.ease;
      expect(first(0.25)).toBe(10.25);
      expect(second(0.75)).toBe(0.75);
    });
    globalThis.registerWorklet('main-thread', 'consumer', consumer);

    globalThis.runWorklet({ _wkltId: 'consumer' }, [
      {
        duration: 0.8,
        ease: [{ _wcid: 1 }, { _wcid: 2 }],
      },
    ]);
    expect(consumer).toBeCalled();
    expect(calls).toEqual([['a', 0.25, 10], ['b', 0.75]]);
  });

  it('should keep a stable function identity while the ctx is updated', () => {
    initWorklet();

    globalThis.registerWorklet('main-thread', 'template', function() {
      return this._c.x;
    });
    updateCallableCtxChanges([[1, { _wkltId: 'template', _c: { x: 1 } }]]);

    let retained;
    globalThis.registerWorklet('main-thread', 'consumer', function() {
      return this._c.callable;
    });
    const capture = () =>
      globalThis.runWorklet({
        _wkltId: 'consumer',
        _c: { callable: { _wcid: 1 } },
      });

    retained = capture();
    expect(retained()).toBe(1);

    // A rerender pushes a fresh ctx with new captured values.
    updateCallableCtxChanges([[1, { _wkltId: 'template', _c: { x: 2 } }]]);
    expect(retained()).toBe(2);

    // Re-capturing resolves to the same realized function.
    expect(capture()).toBe(retained);
  });

  it('should release the callable on a null ctx patch', () => {
    initWorklet();

    globalThis.registerWorklet('main-thread', 'template', () => 1);
    updateCallableCtxChanges([[1, { _wkltId: 'template' }]]);

    let retained;
    globalThis.registerWorklet('main-thread', 'consumer', function() {
      retained = this._c.callable;
    });
    globalThis.runWorklet({
      _wkltId: 'consumer',
      _c: { callable: { _wcid: 1 } },
    });

    expect(retained()).toBe(1);
    updateCallableCtxChanges([[1, null]]);
    expect(() => retained()).toThrowError(
      'MainThreadEvent: event 1 is not registered. It may have been released on unmount.',
    );
  });

  it('should release the callable on the release event', () => {
    initWorklet();

    const jsContext = {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    globalThis.lynx.getJSContext = () => jsContext;
    initEventListeners();

    globalThis.registerWorklet('main-thread', 'template', () => 1);
    updateCallableCtxChanges([[1, { _wkltId: 'template' }]]);

    let retained;
    globalThis.registerWorklet('main-thread', 'consumer', function() {
      retained = this._c.callable;
    });
    globalThis.runWorklet({
      _wkltId: 'consumer',
      _c: { callable: { _wcid: 1 } },
    });
    expect(retained()).toBe(1);

    const releaseListener = jsContext.addEventListener.mock.calls.find(
      ([type]) => type === 'Lynx.Worklet.releaseMainThreadCallable',
    )[1];
    releaseListener({ data: { id: 1 } });
    expect(() => retained()).toThrowError(
      'MainThreadEvent: event 1 is not registered. It may have been released on unmount.',
    );
  });

  it('should resolve first-screen callables with negative ids', () => {
    initWorklet();

    globalThis.registerWorklet('main-thread', 'template', function() {
      return this._c.x;
    });
    globalThis.lynxWorkletImpl._callableImpl.registerFirstScreenCallableCtx(-1, {
      _wkltId: 'template',
      _c: { x: 42 },
    });

    let retained;
    globalThis.registerWorklet('main-thread', 'consumer', function() {
      retained = this._c.callable;
    });
    globalThis.runWorklet({
      _wkltId: 'consumer',
      _c: { callable: { _wcid: -1 } },
    });
    expect(retained()).toBe(42);

    globalThis.lynxWorkletImpl._callableImpl.clearFirstScreenCallableCtxMap();
    expect(() => retained()).toThrowError(
      'MainThreadEvent: event -1 is not registered. It may have been released on unmount.',
    );
  });

  it('should return undefined when the worklet runtime is unavailable', () => {
    initWorklet();

    globalThis.registerWorklet('main-thread', 'template', () => 1);
    updateCallableCtxChanges([[1, { _wkltId: 'template' }]]);

    let retained;
    globalThis.registerWorklet('main-thread', 'consumer', function() {
      retained = this._c.callable;
    });
    globalThis.runWorklet({
      _wkltId: 'consumer',
      _c: { callable: { _wcid: 1 } },
    });

    const runWorklet = globalThis.runWorklet;
    globalThis.runWorklet = undefined;
    expect(retained()).toBe(undefined);
    globalThis.runWorklet = runWorklet;
  });

  it('should realize an instance once and keep its identity stable', () => {
    initWorklet();

    const create = vi.fn(function() {
      return { current: this._c.init };
    });
    globalThis.registerWorklet('main-thread', 'create', create);
    updateCallableCtxChanges([[1, { _wkltId: 'create', _c: { init: 7 } }]]);

    let retained;
    globalThis.registerWorklet('main-thread', 'consumer', function() {
      retained = this._c.instance;
    });
    const capture = () =>
      globalThis.runWorklet({
        _wkltId: 'consumer',
        _c: { instance: { _wiid: 1 } },
      });

    capture();
    expect(retained).toEqual({ current: 7 });
    expect(create).toBeCalledTimes(1);

    const first = retained;
    capture();
    expect(retained).toBe(first);
    expect(create).toBeCalledTimes(1);
  });

  it('should run dispose with the realized object on release', () => {
    initWorklet();

    globalThis.registerWorklet('main-thread', 'create', function() {
      return { stopped: false };
    });
    const dispose = vi.fn((obj) => {
      obj.stopped = true;
    });
    globalThis.registerWorklet('main-thread', 'dispose', dispose);
    updateCallableCtxChanges([[1, {
      _wkltId: 'create',
      _instDispose: { _wkltId: 'dispose' },
    }]]);

    let retained;
    globalThis.registerWorklet('main-thread', 'consumer', function() {
      retained = this._c.instance;
    });
    globalThis.runWorklet({
      _wkltId: 'consumer',
      _c: { instance: { _wiid: 1 } },
    });
    expect(retained.stopped).toBe(false);

    updateCallableCtxChanges([[1, null]]);
    expect(dispose).toBeCalledTimes(1);
    expect(retained.stopped).toBe(true);

    // Double release does not run dispose again.
    updateCallableCtxChanges([[1, null]]);
    expect(dispose).toBeCalledTimes(1);
  });

  it('should not run dispose when the instance was never realized', () => {
    initWorklet();

    const dispose = vi.fn();
    globalThis.registerWorklet('main-thread', 'create', () => ({}));
    globalThis.registerWorklet('main-thread', 'dispose', dispose);
    updateCallableCtxChanges([[1, {
      _wkltId: 'create',
      _instDispose: { _wkltId: 'dispose' },
    }]]);

    updateCallableCtxChanges([[1, null]]);
    expect(dispose).not.toBeCalled();
  });

  it('should throw when realizing a released instance', () => {
    initWorklet();

    globalThis.registerWorklet('main-thread', 'consumer', function() {
      return this._c.instance;
    });
    expect(() =>
      globalThis.runWorklet({
        _wkltId: 'consumer',
        _c: { instance: { _wiid: 1 } },
      })
    ).toThrowError(
      'MainThreadInstance: instance 1 is not registered. It may have been released on unmount.',
    );
  });

  it('should run effect ctxs with a cleanup cycle', () => {
    initWorklet();

    const log = [];
    globalThis.registerWorklet('main-thread', 'effect', function() {
      const run = this._c.run;
      log.push(['effect', run]);
      return () => {
        log.push(['cleanup', run]);
      };
    });

    updateCallableCtxChanges([[1, { _wkltId: 'effect', _c: { run: 1 } }]]);
    globalThis.lynxWorkletImpl._callableImpl.runCallableCtxs([1]);
    expect(log).toEqual([['effect', 1]]);

    // The cleanup of the previous run runs before the next run.
    updateCallableCtxChanges([[1, { _wkltId: 'effect', _c: { run: 2 } }]]);
    globalThis.lynxWorkletImpl._callableImpl.runCallableCtxs([1]);
    expect(log).toEqual([['effect', 1], ['cleanup', 1], ['effect', 2]]);

    // The release runs the pending cleanup.
    updateCallableCtxChanges([[1, null]]);
    expect(log).toEqual([['effect', 1], ['cleanup', 1], ['effect', 2], ['cleanup', 2]]);
  });

  it('should not store a cleanup when the effect returns nothing', () => {
    initWorklet();

    const effect = vi.fn();
    globalThis.registerWorklet('main-thread', 'effect', effect);
    updateCallableCtxChanges([[1, { _wkltId: 'effect' }]]);
    globalThis.lynxWorkletImpl._callableImpl.runCallableCtxs([1]);
    expect(effect).toBeCalledTimes(1);
    updateCallableCtxChanges([[1, null]]);
  });

  it('should skip run requests for unregistered ids', () => {
    initWorklet();

    expect(() => globalThis.lynxWorkletImpl._callableImpl.runCallableCtxs([99])).not.toThrow();
  });

  it('should dispose first-screen instances when the first-screen map is cleared', () => {
    initWorklet();

    globalThis.registerWorklet('main-thread', 'create', function() {
      return { name: this._c.name };
    });
    const dispose = vi.fn();
    globalThis.registerWorklet('main-thread', 'dispose', dispose);
    globalThis.lynxWorkletImpl._callableImpl.registerFirstScreenCallableCtx(-1, {
      _wkltId: 'create',
      _c: { name: 'fs' },
      _instDispose: { _wkltId: 'dispose' },
    });

    let retained;
    globalThis.registerWorklet('main-thread', 'consumer', function() {
      retained = this._c.instance;
    });
    globalThis.runWorklet({
      _wkltId: 'consumer',
      _c: { instance: { _wiid: -1 } },
    });
    expect(retained).toEqual({ name: 'fs' });

    // Hydration clears the first-screen map: the first-screen instance is
    // disposed and not carried over — its identity is not preserved.
    globalThis.lynxWorkletImpl._callableImpl.clearFirstScreenCallableCtxMap();
    expect(dispose).toBeCalledWith({ name: 'fs' });
    expect(() =>
      globalThis.runWorklet({
        _wkltId: 'consumer',
        _c: { instance: { _wiid: -1 } },
      })
    ).toThrowError(
      'MainThreadInstance: instance -1 is not registered. It may have been released on unmount.',
    );
  });

  it('should retain installed ctxs for the js function lifecycle manager', () => {
    initWorklet();

    const addRef = vi.spyOn(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager, 'addRef');
    const ctx = { _wkltId: 'template', _execId: 666, _jsFn: { _jsFn1: { _jsFnId: 1 } } };
    updateCallableCtxChanges([[1, ctx]]);
    expect(addRef).toBeCalledWith(666, ctx);
  });

  it('should not retain ctxs without an execId', () => {
    initWorklet();

    const addRef = vi.spyOn(globalThis.lynxWorkletImpl._jsFunctionLifecycleManager, 'addRef');
    updateCallableCtxChanges([[1, { _wkltId: 'template' }]]);
    expect(addRef).not.toBeCalled();
  });
});
