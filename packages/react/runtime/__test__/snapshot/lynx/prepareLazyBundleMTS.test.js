// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/* global lynx */

// `prepareLazyBundleMTS` is the MT-side handler registered for the
// `rLynxPrepareLazyBundleMTS` lifecycle. It runs after BG calls
// `callLepusMethod`, with the bundle already in native cache (so
// `lynx.fetchBundle(url, {}).then(cb)` fires sync on lepus).

describe('prepareLazyBundleMTS handler', () => {
  let fetchBundle;
  let thenMock;
  let loadScript;
  let loadStyleSheet;
  let adoptStyleSheet;
  let processEvalResult;
  let injectPrepareLazyBundleMTS;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();

    thenMock = vi.fn();
    fetchBundle = vi.fn(() => ({ then: thenMock }));
    loadScript = vi.fn();
    loadStyleSheet = vi.fn();
    adoptStyleSheet = vi.fn();
    processEvalResult = vi.fn();

    vi
      .stubGlobal('lynx', { fetchBundle, loadScript })
      .stubGlobal('__LoadStyleSheet', loadStyleSheet)
      .stubGlobal('__AdoptStyleSheet', adoptStyleSheet)
      .stubGlobal('processEvalResult', processEvalResult);

    ({ injectPrepareLazyBundleMTS } = await import(
      '../../../src/snapshot/lynx/prepareLazyBundleMTS'
    ));
    injectPrepareLazyBundleMTS();
  });

  afterEach(() => {
    delete globalThis.rLynxPrepareLazyBundleMTS;
    vi.unstubAllGlobals();
  });

  function invoke(url) {
    return globalThis.rLynxPrepareLazyBundleMTS({ url });
  }

  test('happy path: fetchBundle.then → loadScript(main-thread) → processEvalResult → CSS adopt', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockReturnValueOnce({ chunk: 'x' });
    loadStyleSheet.mockReturnValueOnce({ id: 'sheet' });

    invoke('foo');

    expect(fetchBundle).toHaveBeenCalledWith('foo', {});
    expect(loadScript).toHaveBeenCalledWith('main-thread', { bundleName: 'u' });
    expect(processEvalResult).toHaveBeenCalledWith(expect.any(Function), 'foo');
    // The factory passed to processEvalResult returns the loaded chunk.
    const factory = processEvalResult.mock.calls[0][0];
    expect(factory()).toEqual({ chunk: 'x' });
    expect(loadStyleSheet).toHaveBeenCalledWith('CSS', 'u');
    expect(adoptStyleSheet).toHaveBeenCalledWith({ id: 'sheet' });
  });

  test('cache: second call with same url is a no-op', () => {
    thenMock.mockImplementation((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockReturnValue({ chunk: 'x' });
    loadStyleSheet.mockReturnValue(null);

    invoke('foo');
    invoke('foo');

    expect(fetchBundle).toHaveBeenCalledTimes(1);
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(processEvalResult).toHaveBeenCalledTimes(1);
  });

  test('cache: different urls are not deduped', () => {
    thenMock.mockImplementation((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockReturnValue({ chunk: 'x' });
    loadStyleSheet.mockReturnValue(null);

    invoke('foo');
    invoke('bar');

    expect(fetchBundle).toHaveBeenCalledTimes(2);
    expect(fetchBundle).toHaveBeenNthCalledWith(1, 'foo', {});
    expect(fetchBundle).toHaveBeenNthCalledWith(2, 'bar', {});
  });

  test('fetchBundle throws sync → silent skip, no side effects', () => {
    fetchBundle.mockImplementationOnce(() => {
      throw new Error('net');
    });

    expect(() => invoke('foo')).not.toThrow();
    expect(loadScript).not.toHaveBeenCalled();
    expect(processEvalResult).not.toHaveBeenCalled();
    expect(loadStyleSheet).not.toHaveBeenCalled();
  });

  test('response.code !== 0 → silent skip', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 1, url: 'u' }));

    invoke('foo');

    expect(loadScript).not.toHaveBeenCalled();
    expect(processEvalResult).not.toHaveBeenCalled();
    expect(loadStyleSheet).not.toHaveBeenCalled();
  });

  test('loadScript throws (BG-only bundle) → no processEvalResult, no CSS', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockImplementationOnce(() => {
      throw new Error('no MTS section');
    });

    expect(() => invoke('foo')).not.toThrow();
    expect(processEvalResult).not.toHaveBeenCalled();
    expect(loadStyleSheet).not.toHaveBeenCalled();
  });

  test('processEvalResult absent → still loadScript + CSS adopt', async () => {
    // Re-import without processEvalResult global.
    vi.resetModules();
    delete globalThis.rLynxPrepareLazyBundleMTS;
    vi.unstubAllGlobals();
    thenMock = vi.fn((cb) => cb({ code: 0, url: 'u' }));
    fetchBundle = vi.fn(() => ({ then: thenMock }));
    loadScript = vi.fn(() => ({ chunk: 'x' }));
    loadStyleSheet = vi.fn(() => ({ id: 'sheet' }));
    adoptStyleSheet = vi.fn();
    vi
      .stubGlobal('lynx', { fetchBundle, loadScript })
      .stubGlobal('__LoadStyleSheet', loadStyleSheet)
      .stubGlobal('__AdoptStyleSheet', adoptStyleSheet);
    // No processEvalResult stub.

    const fresh = await import(
      '../../../src/snapshot/lynx/prepareLazyBundleMTS'
    );
    fresh.injectPrepareLazyBundleMTS();

    expect(() => globalThis.rLynxPrepareLazyBundleMTS({ url: 'foo' })).not.toThrow();
    expect(loadScript).toHaveBeenCalled();
    expect(adoptStyleSheet).toHaveBeenCalledWith({ id: 'sheet' });
  });

  test('null stylesheet → no AdoptStyleSheet call', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockReturnValueOnce({ chunk: 'x' });
    loadStyleSheet.mockReturnValueOnce(null);

    invoke('foo');

    expect(loadStyleSheet).toHaveBeenCalled();
    expect(adoptStyleSheet).not.toHaveBeenCalled();
  });
});
