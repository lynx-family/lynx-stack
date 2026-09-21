// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Element } from '../../src/worklet-runtime/api/element';
import { initApiEnv } from '../../src/worklet-runtime/api/lynxApi';
import { RunWorkletSource } from '../../src/worklet-runtime/bindings/types';
import { hydrateCtx } from '../../src/worklet-runtime/hydrate';
import { updateWorkletRefInitValueChanges } from '../../src/worklet-runtime/workletRef';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

describe('Worklet', () => {
  const consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

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

  afterAll(() => {
    consoleMock.mockReset();
  });

  it.each(['cycle', 'metadata', 'proxy'])('preserves realized %s targets in shared captures', (kind) => {
    initWorklet();
    const value = kind === 'proxy'
      ? new Proxy({}, {
        get() {
          throw new Error('target must remain opaque');
        },
      })
      : kind === 'metadata'
      ? { nested: { _wvid: 999 }, _wkltId: 'user-data' }
      : {};
    if (kind === 'cycle') value.self = value;
    lynxWorkletImpl._refImpl.registerMainThreadObjectType('@test/shared', () => value, 1);
    updateWorkletRefInitValueChanges([[1, null, '@test/shared']]);
    registerWorklet('main-thread', 'shared', function() {
      return this._c.holder.value;
    });
    const holder = { value: { _wvid: 1, _type: '@test/shared', _initValue: null } };
    expect(runWorklet({ _wkltId: 'shared', _c: { holder } }, [])).toBe(value);
    expect(runWorklet({ _wkltId: 'shared', _c: { holder } }, [])).toBe(value);
    if (kind === 'metadata') expect(value.nested).toEqual({ _wvid: 999 });
  });

  it('worklet should be called', () => {
    initWorklet();

    const fn = vi.fn();
    globalThis.registerWorklet('main-thread', '1', fn);
    let worklet = {
      _wkltId: '1',
    };
    globalThis.runWorklet(worklet);
    expect(fn).toBeCalled();
  });

  it.each(['direct', 'nested', 'array'])('snapshots a %s method getter without consuming the source', (kind) => {
    initWorklet();
    const getter = vi.fn(function() {
      return { _wkltId: 'method', value: this.value };
    });
    const source = { value: 1 };
    Object.defineProperty(source, 'method', { get: getter, enumerable: true, configurable: true });
    const holder = kind === 'direct' ? source : kind === 'array' ? [source] : { source };
    registerWorklet('main-thread', 'method', function() {
      return this.value;
    });
    registerWorklet('main-thread', 'parent', function() {
      return this._c.holder;
    });
    const capture = () => runWorklet({ _wkltId: 'parent', _c: { holder } }, []);
    const method = captured =>
      kind === 'direct' ? captured.method : kind === 'array' ? captured[0].method : captured.source.method;
    const first = capture();
    expect(getter).toHaveBeenCalledTimes(1);
    expect(method(first)()).toBe(1);
    source.value = 2;
    const second = capture();
    expect(getter).toHaveBeenCalledTimes(2);
    expect(method(second)()).toBe(2);
    expect(method(first)()).toBe(1);
    expect(Object.getOwnPropertyDescriptor(source, 'method').get).toBe(getter);
    if (kind === 'nested') expect(holder.source).toBe(source);
    if (kind === 'array') expect(Array.isArray(first)).toBe(true);
  });

  it.each(['root', 'captured'])('copies sibling nested worklet captures on the %s context', (placement) => {
    initWorklet();
    const getter = vi.fn(function() {
      return { _wkltId: 'method', value: this.value };
    });
    const source = { value: 1 };
    Object.defineProperty(source, 'method', { get: getter, enumerable: true, configurable: true });
    const nested = { _wkltId: 'nested', _c: { source } };
    const siblings = { first: nested, second: nested };
    registerWorklet('main-thread', 'method', function() {
      return this.value;
    });
    registerWorklet('main-thread', 'nested', function() {
      return this._c.source.method();
    });
    registerWorklet('main-thread', 'parent', function() {
      return this._c ? this._c.siblings : this;
    });
    const capture = () =>
      runWorklet(
        placement === 'root'
          ? { _wkltId: 'parent', ...siblings }
          : { _wkltId: 'parent', _c: { siblings } },
        [],
      );
    const first = capture();
    expect(first.first()).toBe(1);
    expect(first.second()).toBe(1);
    expect(getter).toHaveBeenCalledTimes(2);
    expect(siblings.first).toBe(nested);
    expect(siblings.second).toBe(nested);
    expect(nested._c.source).toBe(source);
    source.value = 2;
    const second = capture();
    expect(second.first()).toBe(2);
    expect(second.second()).toBe(2);
    expect(first.first()).toBe(1);
    expect(first.second()).toBe(1);
    expect(getter).toHaveBeenCalledTimes(4);
  });

  it('hydrates the executed method getter context without reading the source again', () => {
    initWorklet();
    const getter = vi.fn(() => ({ _wkltId: 'method', _jsFn: { callback: { _isFirstScreen: true } } }));
    const source = {};
    Object.defineProperty(source, 'method', { get: getter, enumerable: true, configurable: true });
    registerWorklet('main-thread', 'method', function() {
      return this._jsFn.callback;
    });
    registerWorklet('main-thread', 'parent', function() {
      return this._c.source.method;
    });
    const firstScreen = { _wkltId: 'parent', _c: { source } };
    const method = runWorklet(firstScreen, []);
    const executedHandle = method();
    expect(method.boundCtx._jsFn.callback).toBe(executedHandle);
    hydrateCtx({
      _wkltId: 'parent',
      _execId: 8,
      _c: { source: { method: { _wkltId: 'method', _jsFn: { callback: { _jsFnId: 3 } } } } },
    }, firstScreen);
    expect(executedHandle).toMatchObject({ _isFirstScreen: false, _jsFnId: 3, _execId: 8 });
    expect(getter).toHaveBeenCalledTimes(1);
  });

  it('latest registration should win when the same worklet id is reused', () => {
    initWorklet();

    const first = vi.fn();
    const second = vi.fn();
    globalThis.registerWorklet('main-thread', '1', first);
    globalThis.registerWorklet('main-thread', '1', second);

    globalThis.runWorklet({
      _wkltId: '1',
    });

    expect(first).not.toBeCalled();
    expect(second).toBeCalled();
  });

  it.each([{}, { _lepusWorkletHash: 'legacy' }])('rejects invalid factory descriptors %j', (descriptor) => {
    initWorklet();
    lynxWorkletImpl._refImpl.registerMainThreadObjectType('@test/invalid-factory', descriptor, 1);
    expect(() => updateWorkletRefInitValueChanges([[1, null, '@test/invalid-factory']]))
      .toThrow('Cannot resolve an invalid Main Thread Function.');
  });

  it('worklet should be called with arguments', async () => {
    initWorklet();

    const fn = vi.fn(function(event) {
      const { abc, wv } = this._c;
      let { _jsFn1 } = this._jsFn;
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      expect(event).toBe(1);
      expect(abc).toBe(22);
      expect(wv.current).toBe(333);
      expect(_jsFn1).toMatchInlineSnapshot(`
        {
          "_execId": 666,
          "_jsFnId": 1,
        }
      `);
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[178, 333]]);

    let wv = {
      _wvid: 178,
    };

    let worklet = {
      _c: {
        abc: 22,
        wv: wv,
      },
      _jsFn: {
        _jsFn1: {
          _jsFnId: 1,
        },
      },
      _wkltId: '1',
      _execId: 666,
    };
    globalThis.runWorklet(worklet, [1]);
    expect(fn).toBeCalled();
  });

  it('should support calling another worklet', async () => {
    initWorklet();

    const fn2 = vi.fn(function(arg1, arg2) {
      const { wv } = this._c;
      globalThis.lynxWorkletImpl._workletMap['2'].bind(this);
      expect(arg1).toBe(1);
      expect(arg2.current).toBe(22);
      expect(wv.current).toBe(333);
    });
    globalThis.registerWorklet('main-thread', '2', fn2);
    updateWorkletRefInitValueChanges([
      [1, 333],
      [2, 22],
    ]);

    const fn1 = vi.fn(function(arg2) {
      const { worklet2, arg1 } = this._c;
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      worklet2(arg1, arg2);
    });
    globalThis.registerWorklet('main-thread', '1', fn1);

    let wv = {
      _wvid: 1,
    };

    let worklet2 = {
      _c: {
        wv: wv,
      },
      _wkltId: '2',
    };

    let worklet = {
      _c: {
        worklet2: worklet2,
        arg1: 1,
      },
      _wkltId: '1',
    };

    let arg2 = {
      _wvid: 2,
    };
    globalThis.runWorklet(worklet, [arg2]);
    expect(globalThis.lynxWorkletImpl._workletMap['2']).toBeCalled();
  });

  it('does not weakly reference the root worklet ctx', () => {
    initWorklet();

    const NativeWeakRef = globalThis.WeakRef;
    const workletCtx = {
      _wkltId: 'parent',
      token: 1,
    };
    globalThis.WeakRef = vi.fn(function(target) {
      if (target === workletCtx) {
        throw new TypeError('WeakRef: target must be an object');
      }
      return new NativeWeakRef(target);
    });

    try {
      globalThis.registerWorklet('main-thread', 'parent', function() {
        return this.token;
      });

      expect(globalThis.runWorklet(workletCtx, [])).toBe(1);
    } finally {
      globalThis.WeakRef = NativeWeakRef;
    }
  });

  it('supports nested worklet contexts that cannot be weakly referenced', () => {
    initWorklet();

    const NativeWeakRef = globalThis.WeakRef;
    const childCtx = {
      _wkltId: 'child',
      token: 2,
    };
    const parentCtx = {
      _wkltId: 'parent',
      child: childCtx,
    };
    globalThis.WeakRef = vi.fn(function(target) {
      if (target === childCtx) {
        throw new TypeError('WeakRef: target must be an object');
      }
      return new NativeWeakRef(target);
    });

    try {
      globalThis.registerWorklet('main-thread', 'child', function() {
        return this.token;
      });
      globalThis.registerWorklet('main-thread', 'parent', function() {
        return this.child;
      });

      const childWorklet = globalThis.runWorklet(parentCtx, []);

      expect(childWorklet()).toBe(2);
      expect(childWorklet.boundCtx).not.toBe(childCtx);
      expect(childWorklet.boundCtx.token).toBe(2);
    } finally {
      globalThis.WeakRef = NativeWeakRef;
    }
  });

  it('should call recursively', async () => {
    initWorklet();

    const fn = vi.fn(function() {
      const { wv1 } = this._c;
      const worklet = globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      if (++wv1.current < 5) {
        worklet(wv1.current);
      }
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[1, 0]]);

    let wv1 = {
      _wvid: 1,
    };

    let worklet = {
      _c: {
        wv1: wv1,
      },
      _wkltId: '1',
    };
    globalThis.runWorklet(worklet, []);
    expect(fn).toHaveBeenLastCalledWith(4);
  });

  it('value of a workletRef should be preserved between calls', async () => {
    initWorklet();

    let value = 0;
    const fn = vi.fn(function() {
      const { wv1 } = this._c;
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      value = ++wv1.current;
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[1, 0]]);

    let worklet = {
      _c: {
        wv1: {
          _wvid: 1,
        },
      },
      _wkltId: '1',
    };
    globalThis.runWorklet(worklet, []);
    globalThis.runWorklet(worklet, []);
    globalThis.runWorklet(worklet, []);
    globalThis.runWorklet(worklet, []);
    globalThis.runWorklet(worklet, []);
    expect(value).toBe(5);
  });

  it('treats MainThreadObject descriptors as atomic user payloads', () => {
    initWorklet();

    const initialValue = {
      workletRefLike: { _wvid: 999 },
      workletLike: { _wkltId: 'payload-worklet' },
      jsFunctionLike: { _jsFnId: 999 },
      elementLike: { elementRefptr: 'payload-element' },
    };
    let deepValue = initialValue;
    for (let index = 0; index < 1000; index++) {
      deepValue.next = {};
      deepValue = deepValue.next;
    }

    const create = vi.fn(value => ({ initialValue: value }));
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/atomic-payload',
      create,
      1,
    );
    globalThis.registerWorklet('main-thread', 'atomic-payload', function(value) {
      return value;
    });

    const value = globalThis.runWorklet({ _wkltId: 'atomic-payload' }, [{
      _wvid: -1,
      _initValue: initialValue,
      _type: '@test/atomic-payload',
    }]);

    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(initialValue);
    expect(value.initialValue).toBe(initialValue);
    expect(initialValue.workletRefLike).toEqual({ _wvid: 999 });
    expect(initialValue.workletLike).toEqual({ _wkltId: 'payload-worklet' });
    expect(initialValue.jsFunctionLike).toEqual({ _jsFnId: 999 });
    expect(initialValue.elementLike).toEqual({ elementRefptr: 'payload-element' });
  });

  it('reuses one realized MainThreadObject for repeated parameter descriptors', () => {
    initWorklet();

    const create = vi.fn(value => ({ value }));
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/repeated-parameter',
      create,
      1,
    );
    globalThis.registerWorklet('main-thread', 'repeated-parameter', function(value) {
      return value;
    });
    const descriptor = {
      _wvid: -2,
      _initValue: 42,
      _type: '@test/repeated-parameter',
    };

    const first = globalThis.runWorklet(
      { _wkltId: 'repeated-parameter' },
      [descriptor],
    );
    const second = globalThis.runWorklet(
      { _wkltId: 'repeated-parameter' },
      [descriptor],
    );

    expect(second).toBe(first);
    expect(create).toHaveBeenCalledOnce();
  });

  it('should support various types of parameters', async () => {
    initWorklet();

    globalThis.lynxWorkletImpl._workletMap['1'] = vi.fn(function(
      argNull,
      argUndefined,
      argNumber,
      argString,
      argArray,
      argObject,
      argWorklet,
      argWorkletRef,
      argElement,
    ) {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      expect(argNull).toBe(null);
      expect(argUndefined).toBe(undefined);
      expect(argNumber).toBe(888);
      expect(argString).toBe('str3');
      expect(argArray[0]).toStrictEqual(3);
      expect(argArray[1]).toStrictEqual([4]);
      expect(argArray[2].current).toStrictEqual(5);
      expect(argObject).toStrictEqual({ str: 'str5' });
      expect(argElement).toBeInstanceOf(Element);
      argWorklet(
        argNull,
        argUndefined,
        argNumber,
        argString,
        argArray,
        argObject,
        argWorkletRef,
        argElement,
      );
      expect(argWorkletRef.current).toBe(444);
    });

    globalThis.lynxWorkletImpl._workletMap['arg'] = vi.fn(function(
      argNull,
      argUndefined,
      argNumber,
      argString,
      argArray,
      argObject,
      argWorkletRef,
      argElement,
    ) {
      globalThis.lynxWorkletImpl._workletMap['arg'].bind(this);
      expect(argNull).toBe(null);
      expect(argUndefined).toBe(undefined);
      expect(argNumber).toBe(888);
      expect(argString).toBe('str3');
      expect(argArray[0]).toStrictEqual(3);
      expect(argArray[1]).toStrictEqual([4]);
      expect(argArray[2].current).toStrictEqual(5);
      expect(argObject).toStrictEqual({ str: 'str5' });
      expect(argWorkletRef.current).toBe(444);
      expect(argElement).toBeInstanceOf(Element);
    });

    updateWorkletRefInitValueChanges([
      [1, 444],
      [2, 5],
    ]);

    let argWorkletRef = {
      _wvid: 1,
    };

    let wv5 = {
      _wvid: 2,
    };

    let worklet = {
      _c: {},
      _wkltId: '1',
    };

    let argWorklet = {
      _c: {},
      _wkltId: 'arg',
    };

    let argElement = {
      elementRefptr: 'element',
    };

    globalThis.runWorklet(worklet, [
      null,
      undefined,
      888,
      'str3',
      [3, [4], wv5],
      { str: 'str5' },
      argWorklet,
      argWorkletRef,
      argElement,
    ]);
    expect(globalThis.lynxWorkletImpl._workletMap['arg']).toBeCalled();
  });

  it('should not throw when invalid worklet ctx', () => {
    initWorklet();
    consoleMock.mockClear();

    globalThis.runWorklet({});
    globalThis.runWorklet(undefined);
    globalThis.runWorklet(null);
    globalThis.runWorklet(1);

    expect(consoleMock).not.toHaveBeenCalled();
  });

  it('should not throw when depth of argument exceeds limit', () => {
    const a = {};
    a.a = a;
    initWorklet();
    globalThis.registerWorklet('main-thread', '1', vi.fn());
    expect(() => {
      globalThis.runWorklet({ _wkltId: '1' }, [a]);
    }).toThrow(new Error('Depth of value exceeds limit of 1000.'));
  });

  it('should not throw with nested worklet', () => {
    initWorklet();
    const worklet1 = vi.fn();
    const worklet2 = vi.fn();
    globalThis.registerWorklet('main-thread', '1', worklet1);
    globalThis.registerWorklet('main-thread', '2', worklet2);

    const element = {
      _parent: null,
    };
    element._parent = element;

    const ref = { elementRefptr: element };

    const worklet1Ctx = {
      _wkltId: '1',
      _c: ref,
    };

    globalThis.runWorklet(worklet1Ctx, [1]);
    expect(worklet1).toBeCalledWith(1);

    const worklet2Ctx = {
      _wkltId: '2',
      _c: { worklet1: worklet1Ctx },
    };

    globalThis.runWorklet(worklet2Ctx, [2]);
    expect(worklet2).toBeCalledWith(2);
  });

  it('event object should have stopPropagation and stopImmediatePropagation', async () => {
    initWorklet();
    const fn = vi.fn(function(event) {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      expect(event.stopPropagation).toBeDefined();
      expect(event.stopImmediatePropagation).toBeDefined();
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    globalThis.runWorklet({ _wkltId: '1' }, [{
      target: {},
      currentTarget: {},
    }], {
      source: RunWorkletSource.EVENT,
    });
  });

  it('event object should have returnValue wrapped', async () => {
    initWorklet();
    const fn = vi.fn(function() {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);

      return 1;
    });

    globalThis.registerWorklet('main-thread', '1', fn);
    const ret = globalThis.runWorklet({ _wkltId: '1' }, [{
      target: {},
      currentTarget: {},
    }], {
      source: RunWorkletSource.EVENT,
    });

    expect(ret).toMatchObject({
      returnValue: 1,
      eventReturnResult: undefined,
    });
  });

  it('non event object should not have returnValue wrapped', async () => {
    initWorklet();
    const fn = vi.fn(function() {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);

      return 1;
    });

    globalThis.registerWorklet('main-thread', '1', fn);
    const ret = globalThis.runWorklet({ _wkltId: '1' }, [1, 2]);

    expect(ret).toBe(1);
  });
});

it('requestAnimationFrame should throw error before 2.16', async () => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.15',
  };
  initWorklet();

  const fn = vi.fn(function() {
    globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
    expect(() => {
      globalThis.requestAnimationFrame(vi.fn());
    }).toThrow(
      new Error(
        'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
      ),
    );
    expect(() => {
      globalThis.lynx.requestAnimationFrame(vi.fn());
    }).toThrow(
      new Error(
        'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
      ),
    );
  });
  globalThis.registerWorklet('main-thread', '1', fn);
  updateWorkletRefInitValueChanges([[178, 333]]);

  let worklet = {
    _wkltId: '1',
  };
  globalThis.runWorklet(worklet, [1]);
  expect(fn).toBeCalled();
});

it('requestAnimationFrame should throw error before 2.16 2', async () => {
  globalThis.SystemInfo = {};
  initWorklet();

  const fn = vi.fn(function() {
    globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
    expect(() => {
      globalThis.requestAnimationFrame(vi.fn());
    }).toThrow(
      new Error(
        'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
      ),
    );
    expect(() => {
      globalThis.lynx.requestAnimationFrame(vi.fn());
    }).toThrow(
      new Error(
        'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
      ),
    );
  });
  globalThis.registerWorklet('main-thread', '1', fn);
  updateWorkletRefInitValueChanges([[178, 333]]);

  let worklet = {
    _wkltId: '1',
  };
  globalThis.runWorklet(worklet, [1]);
  expect(fn).toBeCalled();
});
