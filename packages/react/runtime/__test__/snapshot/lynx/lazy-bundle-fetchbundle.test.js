// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/* global lynx */

const TIMEOUT_SECONDS = 5;

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals().stubGlobal('__LAZY_BUNDLE_FETCHER__', 'FetchBundle');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadLazyBundle (FetchBundle) — main thread sync', () => {
  let fetchBundle;
  let waitMock;
  let loadScript;
  let loadStyleSheet;
  let adoptStyleSheet;

  beforeEach(() => {
    waitMock = vi.fn();
    fetchBundle = vi.fn(() => ({ wait: waitMock }));
    loadScript = vi.fn();
    loadStyleSheet = vi.fn();
    adoptStyleSheet = vi.fn();
    vi
      .stubGlobal('__LEPUS__', true)
      .stubGlobal('__MAIN_THREAD__', true)
      .stubGlobal('lynx', { fetchBundle, loadScript })
      .stubGlobal('__LoadStyleSheet', loadStyleSheet)
      .stubGlobal('__AdoptStyleSheet', adoptStyleSheet);
  });

  test('happy path: .wait → loadScript(main-thread) → CSS adopt → sync then', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'cached-url' });
    // The main-thread bundle is wrapped as `(globDynamicComponentEntry) => exports`;
    // the loader invokes it with the bundle's own `source`.
    const mtEval = vi.fn(() => ({ default: 'MTChunk' }));
    loadScript.mockReturnValueOnce(mtEval);
    loadStyleSheet.mockReturnValueOnce({ id: 'sheet' });

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');

    expect(fetchBundle).toHaveBeenCalledWith('foo', {});
    expect(waitMock).toHaveBeenCalledWith(TIMEOUT_SECONDS);
    expect(loadScript).toHaveBeenCalledWith('main-thread', {
      bundleName: 'cached-url',
    });
    // Invoked with the bundle's own url so its `globDynamicComponentEntry` is `foo`.
    expect(mtEval).toHaveBeenCalledWith('foo');
    expect(loadStyleSheet).toHaveBeenCalledWith('CSS', 'cached-url');
    expect(adoptStyleSheet).toHaveBeenCalledWith({ id: 'sheet' });

    let thenCalled = false;
    promise.then((v) => {
      expect(v).toEqual({ default: 'MTChunk' });
      thenCalled = true;
    });
    expect(thenCalled).toBe(true);
  });

  test('async mode (mode !== sync) warms the cache via fetchBundle but renders nothing', async () => {
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'async');

    // The main thread fires fetchBundle (fire-and-forget) to warm the native
    // cache so the background async path waits less...
    expect(fetchBundle).toHaveBeenCalledWith('foo', {});
    // ...but does no rendering work here and never resolves.
    expect(loadScript).not.toHaveBeenCalled();
    promise.then(
      () => expect.fail('should not resolve'),
      () => expect.fail('should not reject'),
    );
    await Promise.resolve();
  });

  test('async mode: fetchBundle throw is swallowed → still never-resolving', async () => {
    fetchBundle.mockImplementationOnce(() => {
      throw new Error('fetchBundle unavailable');
    });

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'async');

    // The warm-up fetch threw, but the error is swallowed and nothing renders.
    expect(fetchBundle).toHaveBeenCalledWith('foo', {});
    expect(loadScript).not.toHaveBeenCalled();
    promise.then(
      () => expect.fail('should not resolve'),
      () => expect.fail('should not reject'),
    );
    await Promise.resolve();
  });

  test('.wait throws → never-resolving', async () => {
    waitMock.mockImplementationOnce(() => {
      throw new Error('timeout');
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');

    expect(loadScript).not.toHaveBeenCalled();
    promise.then(
      () => expect.fail('should not resolve'),
      () => expect.fail('should not reject'),
    );
    await Promise.resolve();
  });

  test('response.code !== 0 → never-resolving', async () => {
    waitMock.mockReturnValueOnce({ code: 1, url: 'x' });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');

    expect(loadScript).not.toHaveBeenCalled();
    promise.then(
      () => expect.fail('should not resolve'),
      () => expect.fail('should not reject'),
    );
    await Promise.resolve();
  });

  test('loadScript throws → never-resolving', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'x' });
    loadScript.mockImplementationOnce(() => {
      throw new Error('no MTS section');
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');

    expect(adoptStyleSheet).not.toHaveBeenCalled();
    promise.then(
      () => expect.fail('should not resolve'),
      () => expect.fail('should not reject'),
    );
    await Promise.resolve();
  });

  test('null stylesheet → chunk still resolved, no AdoptStyleSheet', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'x' });
    loadScript.mockReturnValueOnce(() => ({ default: 'C' }));
    loadStyleSheet.mockReturnValueOnce(null);

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');

    expect(loadStyleSheet).toHaveBeenCalled();
    expect(adoptStyleSheet).not.toHaveBeenCalled();

    let resolved;
    promise.then((v) => {
      resolved = v;
    });
    expect(resolved).toEqual({ default: 'C' });
  });
});

describe('loadLazyBundle (FetchBundle) — background sync', () => {
  let fetchBundle;
  let waitMock;
  let loadScript;
  let callLepusMethod;
  let getNativeApp;

  beforeEach(() => {
    waitMock = vi.fn();
    fetchBundle = vi.fn(() => ({ wait: waitMock }));
    loadScript = vi.fn();
    callLepusMethod = vi.fn();
    getNativeApp = vi.fn(() => ({ callLepusMethod }));
    vi
      .stubGlobal('__LEPUS__', false)
      .stubGlobal('__MAIN_THREAD__', false)
      .stubGlobal('__BACKGROUND__', true)
      .stubGlobal('__JS__', true)
      .stubGlobal('lynx', { fetchBundle, loadScript, getNativeApp });
  });

  test('happy path: .wait → loadScript(background) → prepare MTS → sync then', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'u' });
    loadScript.mockReturnValueOnce({ default: 'BG' });

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');

    expect(fetchBundle).toHaveBeenCalledWith('foo', {});
    expect(loadScript).toHaveBeenCalledWith('background', { bundleName: 'u' });
    // A sync bundle loaded on the background thread still triggers the
    // main-thread prepare (createSnapshot side effect) so a non-first-screen
    // component's snapshot is registered.
    expect(callLepusMethod).toHaveBeenCalledWith(
      'rLynxPrepareLazyBundleMTS',
      { url: 'foo', host: undefined },
      expect.any(Function),
    );

    let thenCalled = false;
    promise.then((v) => {
      expect(v).toEqual({ default: 'BG' });
      thenCalled = true;
    });
    expect(thenCalled).toBe(true);
  });

  test('a repeat sync load is served from the success cache (no re-fetch/prepare)', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'u' });
    loadScript.mockReturnValueOnce({ default: 'BG' });

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    let first;
    loadLazyBundle('foo', 'sync').then((v) => {
      first = v;
    });
    expect(first).toEqual({ default: 'BG' });
    expect(fetchBundle).toHaveBeenCalledTimes(1);
    expect(callLepusMethod).toHaveBeenCalledTimes(1);

    let second;
    loadLazyBundle('foo', 'sync').then((v) => {
      second = v;
    });
    // Same exports, served synchronously, without re-fetching or re-preparing.
    expect(second).toEqual({ default: 'BG' });
    expect(fetchBundle).toHaveBeenCalledTimes(1);
    expect(callLepusMethod).toHaveBeenCalledTimes(1);
  });

  test('a failed load is not cached → next load retries', async () => {
    waitMock.mockImplementationOnce(() => {
      throw new Error('timeout');
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    await expect(loadLazyBundle('foo', 'sync')).rejects.toThrow('timeout');

    // Second attempt: the earlier failure was not cached, so it re-fetches.
    waitMock.mockReturnValueOnce({ code: 0, url: 'u' });
    loadScript.mockReturnValueOnce({ default: 'BG' });
    let retried;
    loadLazyBundle('foo', 'sync').then((v) => {
      retried = v;
    });
    expect(retried).toEqual({ default: 'BG' });
    expect(fetchBundle).toHaveBeenCalledTimes(2);
  });

  test('.wait throws → reject', async () => {
    waitMock.mockImplementationOnce(() => {
      throw new Error('timeout');
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');
    await expect(promise).rejects.toThrow('timeout');
  });

  test('response.code !== 0 → reject with cause', async () => {
    waitMock.mockReturnValueOnce({ code: 2, url: 'u' });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');
    await expect(promise).rejects.toMatchObject({
      message: 'Lazy bundle load failed, schema: foo',
      cause: '{"code":2,"url":"u"}',
    });
  });

  test('loadScript throws → reject', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'u' });
    loadScript.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo', 'sync');
    await expect(promise).rejects.toThrow('boom');
  });

  test('undefined response → reject (covers !response branch)', async () => {
    waitMock.mockReturnValueOnce(undefined);
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(
      loadLazyBundle('foo', 'sync'),
    ).rejects.toThrow('Lazy bundle load failed, schema: foo');
  });

  test('.wait throws non-Error → wrapped reject', async () => {
    waitMock.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'string err';
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(
      loadLazyBundle('foo', 'sync'),
    ).rejects.toThrow('string err');
  });

  test('loadScript throws non-Error → wrapped reject', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'u' });
    loadScript.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'load boom';
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(
      loadLazyBundle('foo', 'sync'),
    ).rejects.toThrow('load boom');
  });
});

describe('loadLazyBundle (FetchBundle) — unreachable', () => {
  test('throws when neither MT nor JS', async () => {
    vi.resetModules();
    vi.unstubAllGlobals()
      .stubGlobal('__LAZY_BUNDLE_FETCHER__', 'FetchBundle')
      .stubGlobal('__MAIN_THREAD__', false)
      .stubGlobal('__LEPUS__', false)
      .stubGlobal('__JS__', false)
      .stubGlobal('__BACKGROUND__', false);
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    expect(() => loadLazyBundle('foo')).toThrow('unreachable');
  });
});

describe('loadLazyBundle (FetchBundle) — background async (cb-as-readiness)', () => {
  let fetchBundle;
  let thenMock;
  let loadScript;
  let callLepusMethod;
  let getNativeApp;

  beforeEach(() => {
    thenMock = vi.fn();
    fetchBundle = vi.fn(() => ({ then: thenMock }));
    loadScript = vi.fn();
    callLepusMethod = vi.fn();
    getNativeApp = vi.fn(() => ({ callLepusMethod }));
    vi
      .stubGlobal('__LEPUS__', false)
      .stubGlobal('__MAIN_THREAD__', false)
      .stubGlobal('__BACKGROUND__', true)
      .stubGlobal('__JS__', true)
      .stubGlobal('lynx', { fetchBundle, loadScript, getNativeApp });
  });

  test('happy path: .then → loadScript → callLepusMethod → cb resolves', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockReturnValueOnce({ default: 'BG' });
    callLepusMethod.mockImplementationOnce((_name, _payload, cb) => cb());

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo');

    expect(callLepusMethod).toHaveBeenCalledWith(
      'rLynxPrepareLazyBundleMTS',
      { url: 'foo' },
      expect.any(Function),
    );
    await expect(promise).resolves.toEqual({ default: 'BG' });
  });

  test('threads the loading `host` into the prepare payload', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockReturnValueOnce({ default: 'BG' });
    callLepusMethod.mockImplementationOnce((_n, _p, cb) => cb());

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    await loadLazyBundle('foo', undefined, '__Card__');

    expect(callLepusMethod).toHaveBeenCalledWith(
      'rLynxPrepareLazyBundleMTS',
      { url: 'foo', host: '__Card__' },
      expect.any(Function),
    );
  });

  test('sets globalThis.globDynamicComponentEntry to the url around bts loadScript', async () => {
    const before = globalThis.globDynamicComponentEntry;
    const seen = [];
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockImplementationOnce(() => {
      seen.push(globalThis.globDynamicComponentEntry);
      return { default: 'BG' };
    });
    callLepusMethod.mockImplementationOnce((_n, _p, cb) => cb());

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    await loadLazyBundle('foo');

    // Set to the bundle's own url while evaluating, restored after.
    expect(seen).toEqual(['foo']);
    expect(globalThis.globDynamicComponentEntry).toBe(before);
  });

  test('cb only fires AFTER loadScript completes (sequencing)', async () => {
    const events = [];
    thenMock.mockImplementationOnce((cb) => {
      events.push('then-start');
      cb({ code: 0, url: 'u' });
      events.push('then-end');
    });
    loadScript.mockImplementationOnce(() => {
      events.push('loadScript');
      return { default: 'BG' };
    });
    callLepusMethod.mockImplementationOnce((_n, _p, cb) => {
      events.push('callLepusMethod-start');
      cb();
      events.push('callLepusMethod-cb');
    });

    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );

    await loadLazyBundle('foo');
    expect(events).toEqual([
      'then-start',
      'loadScript',
      'callLepusMethod-start',
      'callLepusMethod-cb',
      'then-end',
    ]);
  });

  test('fetchBundle throws sync → reject', async () => {
    fetchBundle.mockImplementationOnce(() => {
      throw new Error('net');
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toThrow('net');
    expect(callLepusMethod).not.toHaveBeenCalled();
  });

  test('response.code !== 0 → reject with cause, no loadScript', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 1, url: 'u' }));
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toMatchObject({
      message: 'Lazy bundle load failed, schema: foo',
      cause: '{"code":1,"url":"u"}',
    });
    expect(loadScript).not.toHaveBeenCalled();
    expect(callLepusMethod).not.toHaveBeenCalled();
  });

  test('undefined response → reject (covers !response branch)', async () => {
    thenMock.mockImplementationOnce((cb) => cb(undefined));
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toThrow(
      'Lazy bundle load failed, schema: foo',
    );
  });

  test('fetchBundle throws non-Error sync → wrapped reject', async () => {
    fetchBundle.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'string err';
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toThrow('string err');
  });

  test('callLepusMethod throws non-Error → wrapped reject', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockReturnValueOnce({ default: 'BG' });
    callLepusMethod.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'lepus boom';
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toThrow('lepus boom');
  });

  test('loadScript throws non-Error → wrapped reject', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'load boom';
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toThrow('load boom');
  });

  test('loadScript throws → reject, no callLepusMethod', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toThrow('boom');
    expect(callLepusMethod).not.toHaveBeenCalled();
  });

  test('callLepusMethod throws → reject', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockReturnValueOnce({ default: 'BG' });
    callLepusMethod.mockImplementationOnce(() => {
      throw new Error('lepus down');
    });
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toThrow('lepus down');
  });
});

describe('mode + QueryComponent — dev throw', () => {
  beforeEach(() => {
    vi
      .stubGlobal('__LEPUS__', false)
      .stubGlobal('__MAIN_THREAD__', false)
      .stubGlobal('__BACKGROUND__', true)
      .stubGlobal('__JS__', true)
      .stubGlobal('__LAZY_BUNDLE_FETCHER__', 'QueryComponent')
      .stubGlobal('lynx', { QueryComponent: vi.fn() })
      .stubGlobal('lynxCoreInject', { tt: { getDynamicComponentExports: vi.fn() } });
  });

  test('__DEV__ + mode set → throws', async () => {
    vi.stubGlobal('__DEV__', true);
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    expect(() => loadLazyBundle('foo', 'sync')).toThrow(
      /requires FetchBundle/,
    );
  });

  test('prod (__DEV__: false) + mode set → no throw, falls through to QueryComponent', async () => {
    vi.stubGlobal('__DEV__', false);
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    // Doesn't throw; still calls QueryComponent (callback never fires here, so promise pends).
    expect(() => loadLazyBundle('foo', 'sync')).not.toThrow();
    expect(lynx.QueryComponent).toHaveBeenCalledWith('foo', expect.any(Function));
  });

  test('__DEV__ + no mode → no throw', async () => {
    vi.stubGlobal('__DEV__', true);
    const { loadLazyBundle } = await import(
      '../../../src/core/lynx/lazy-bundle'
    );
    expect(() => loadLazyBundle('foo')).not.toThrow();
  });
});
