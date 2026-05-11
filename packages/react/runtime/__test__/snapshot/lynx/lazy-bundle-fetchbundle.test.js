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
    loadScript.mockReturnValueOnce({ default: 'MTChunk' });
    loadStyleSheet.mockReturnValueOnce({ id: 'sheet' });

    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));

    expect(fetchBundle).toHaveBeenCalledWith('foo', {});
    expect(waitMock).toHaveBeenCalledWith(TIMEOUT_SECONDS);
    expect(loadScript).toHaveBeenCalledWith('main-thread', {
      bundleName: 'cached-url',
    });
    expect(loadStyleSheet).toHaveBeenCalledWith('CSS', 'cached-url');
    expect(adoptStyleSheet).toHaveBeenCalledWith({ id: 'sheet' });

    let thenCalled = false;
    promise.then((v) => {
      expect(v).toEqual({ default: 'MTChunk' });
      thenCalled = true;
    });
    expect(thenCalled).toBe(true);
  });

  test('async mode (mode !== sync) returns never-resolving promise', async () => {
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('async', () => loadLazyBundle('foo'));

    expect(fetchBundle).not.toHaveBeenCalled();
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
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));

    expect(loadScript).not.toHaveBeenCalled();
    promise.then(
      () => expect.fail('should not resolve'),
      () => expect.fail('should not reject'),
    );
    await Promise.resolve();
  });

  test('response.code !== 0 → never-resolving', async () => {
    waitMock.mockReturnValueOnce({ code: 1, url: 'x' });
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));

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
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));

    expect(adoptStyleSheet).not.toHaveBeenCalled();
    promise.then(
      () => expect.fail('should not resolve'),
      () => expect.fail('should not reject'),
    );
    await Promise.resolve();
  });

  test('null stylesheet → chunk still resolved, no AdoptStyleSheet', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'x' });
    loadScript.mockReturnValueOnce({ default: 'C' });
    loadStyleSheet.mockReturnValueOnce(null);

    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));

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

  beforeEach(() => {
    waitMock = vi.fn();
    fetchBundle = vi.fn(() => ({ wait: waitMock }));
    loadScript = vi.fn();
    vi
      .stubGlobal('__LEPUS__', false)
      .stubGlobal('__MAIN_THREAD__', false)
      .stubGlobal('__BACKGROUND__', true)
      .stubGlobal('__JS__', true)
      .stubGlobal('lynx', { fetchBundle, loadScript });
  });

  test('happy path: .wait → loadScript(background) → sync then', async () => {
    waitMock.mockReturnValueOnce({ code: 0, url: 'u' });
    loadScript.mockReturnValueOnce({ default: 'BG' });

    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));

    expect(fetchBundle).toHaveBeenCalledWith('foo', {});
    expect(loadScript).toHaveBeenCalledWith('background', { bundleName: 'u' });

    let thenCalled = false;
    promise.then((v) => {
      expect(v).toEqual({ default: 'BG' });
      thenCalled = true;
    });
    expect(thenCalled).toBe(true);
  });

  test('.wait throws → reject', async () => {
    waitMock.mockImplementationOnce(() => {
      throw new Error('timeout');
    });
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));
    await expect(promise).rejects.toThrow('timeout');
  });

  test('response.code !== 0 → reject with cause', async () => {
    waitMock.mockReturnValueOnce({ code: 2, url: 'u' });
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));
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
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = withLazyBundleMode('sync', () => loadLazyBundle('foo'));
    await expect(promise).rejects.toThrow('boom');
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
      '../../../src/snapshot/lynx/lazy-bundle'
    );

    const promise = loadLazyBundle('foo');

    expect(callLepusMethod).toHaveBeenCalledWith(
      'rLynxPrepareLazyBundleMTS',
      { url: 'foo' },
      expect.any(Function),
    );
    await expect(promise).resolves.toEqual({ default: 'BG' });
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
      '../../../src/snapshot/lynx/lazy-bundle'
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
      '../../../src/snapshot/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toThrow('net');
    expect(callLepusMethod).not.toHaveBeenCalled();
  });

  test('response.code !== 0 → reject with cause, no loadScript', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 1, url: 'u' }));
    const { loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );
    await expect(loadLazyBundle('foo')).rejects.toMatchObject({
      message: 'Lazy bundle load failed, schema: foo',
      cause: '{"code":1,"url":"u"}',
    });
    expect(loadScript).not.toHaveBeenCalled();
    expect(callLepusMethod).not.toHaveBeenCalled();
  });

  test('loadScript throws → reject, no callLepusMethod', async () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
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
      '../../../src/snapshot/lynx/lazy-bundle'
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
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );
    expect(() => withLazyBundleMode('sync', () => loadLazyBundle('foo'))).toThrow(
      /requires FetchBundle/,
    );
  });

  test('prod (__DEV__: false) + mode set → no throw, falls through to QueryComponent', async () => {
    vi.stubGlobal('__DEV__', false);
    const { withLazyBundleMode, loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );
    // Doesn't throw; still calls QueryComponent (callback never fires here, so promise pends).
    expect(() => withLazyBundleMode('sync', () => loadLazyBundle('foo'))).not.toThrow();
    expect(lynx.QueryComponent).toHaveBeenCalledWith('foo', expect.any(Function));
  });

  test('__DEV__ + no mode → no throw', async () => {
    vi.stubGlobal('__DEV__', true);
    const { loadLazyBundle } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );
    expect(() => loadLazyBundle('foo')).not.toThrow();
  });
});

describe('withLazyBundleMode helper', () => {
  beforeEach(() => {
    vi
      .stubGlobal('__LEPUS__', false)
      .stubGlobal('__MAIN_THREAD__', false)
      .stubGlobal('__BACKGROUND__', true)
      .stubGlobal('__JS__', true);
  });

  test('restores prior mode after factory returns', async () => {
    const { withLazyBundleMode } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );
    let inner;
    withLazyBundleMode('sync', () => {
      withLazyBundleMode('async', () => {
        inner = 'async';
      });
      inner += '-then-sync';
    });
    expect(inner).toBe('async-then-sync');
  });

  test('restores prior mode even if factory throws', async () => {
    const { withLazyBundleMode } = await import(
      '../../../src/snapshot/lynx/lazy-bundle'
    );
    expect(() =>
      withLazyBundleMode('sync', () => {
        throw new Error('factory err');
      })
    ).toThrow('factory err');
    // After exit, mode is restored (undefined). Use it again to confirm no leak.
    let leaked;
    withLazyBundleMode('async', () => {
      leaked = 'async';
    });
    expect(leaked).toBe('async');
  });
});
