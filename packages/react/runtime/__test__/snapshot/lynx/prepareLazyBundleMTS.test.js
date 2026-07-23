// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/* global lynx */

// `prepareLazyBundleMTS` is the MT-side handler registered for the
// `rLynxPrepareLazyBundleMTS` lifecycle. It runs after BG calls
// `callLepusMethod`, with the bundle already in native cache (so
// `lynx.fetchBundle(url, { isLazyBundle: true }).then(cb)` fires sync on lepus).

describe('prepareLazyBundleMTS handler', () => {
  const HOST = '__Card__';
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
    // The main-thread bundle is wrapped as `(globDynamicComponentEntry) => exports`;
    // `loadScript` returns that function and the handler invokes it with the url.
    loadScript = vi.fn(() => () => ({ chunk: 'x' }));
    loadStyleSheet = vi.fn();
    adoptStyleSheet = vi.fn();
    processEvalResult = vi.fn();

    vi
      .stubGlobal('lynx', { fetchBundle, loadScript })
      .stubGlobal('__LoadStyleSheet', loadStyleSheet)
      .stubGlobal('__AdoptStyleSheet', adoptStyleSheet)
      // Handlers are keyed by the loading host's entry, not a single global.
      .stubGlobal('processEvalResultByHost', { [HOST]: processEvalResult });

    ({ injectPrepareLazyBundleMTS } = await import(
      '../../../src/snapshot/lynx/prepareLazyBundleMTS'
    ));
    injectPrepareLazyBundleMTS();
  });

  afterEach(() => {
    delete globalThis.rLynxPrepareLazyBundleMTS;
    vi.unstubAllGlobals();
  });

  function invoke(url, host = HOST) {
    return globalThis.rLynxPrepareLazyBundleMTS({ url, host });
  }

  test('happy path: loadScript(main-thread) → evaluate(url) → host handler → CSS adopt', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    const evaluate = vi.fn(() => ({ chunk: 'x' }));
    loadScript.mockReturnValueOnce(evaluate);
    loadStyleSheet.mockReturnValueOnce({ id: 'sheet' });

    invoke('foo');

    expect(fetchBundle).toHaveBeenCalledWith('foo', {
      isLazyBundle: true,
    });
    expect(loadScript).toHaveBeenCalledWith('main-thread', { bundleName: 'u' });
    // The bundle is evaluated with its own url as `globDynamicComponentEntry`.
    expect(evaluate).toHaveBeenCalledWith('foo');
    expect(processEvalResult).toHaveBeenCalledWith(expect.any(Function), 'foo');
    // The factory passed to the handler returns the loaded chunk.
    const factory = processEvalResult.mock.calls[0][0];
    expect(factory()).toEqual({ chunk: 'x' });
    expect(loadStyleSheet).toHaveBeenCalledWith('CSS', 'u');
    expect(adoptStyleSheet).toHaveBeenCalledWith({ id: 'sheet' });
  });

  test('routes to the loading host, not another host', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    const other = vi.fn();
    vi.stubGlobal('processEvalResultByHost', {
      [HOST]: processEvalResult,
      B: other,
    });

    invoke('foo', HOST);

    expect(processEvalResult).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  test('no host → skip handler, still loadScript + CSS', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadStyleSheet.mockReturnValueOnce({ id: 'sheet' });

    // A standalone component loaded directly carries no `host` in the payload.
    globalThis.rLynxPrepareLazyBundleMTS({ url: 'foo' });

    expect(loadScript).toHaveBeenCalled();
    expect(processEvalResult).not.toHaveBeenCalled();
    expect(adoptStyleSheet).toHaveBeenCalledWith({ id: 'sheet' });
  });

  test('host with no registered handler → skip, still loadScript + CSS', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadStyleSheet.mockReturnValueOnce({ id: 'sheet' });

    invoke('foo', 'unknown-host');

    expect(loadScript).toHaveBeenCalled();
    expect(processEvalResult).not.toHaveBeenCalled();
    expect(adoptStyleSheet).toHaveBeenCalledWith({ id: 'sheet' });
  });

  test('missing stylesheet APIs → chunk still installs', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    vi.stubGlobal('__LoadStyleSheet', undefined);
    vi.stubGlobal('__AdoptStyleSheet', undefined);

    expect(() => invoke('foo')).not.toThrow();
    expect(loadScript).toHaveBeenCalled();
    expect(processEvalResult).toHaveBeenCalled();
  });

  test('cache: second call with same url is a no-op', () => {
    thenMock.mockImplementation((cb) => cb({ code: 0, url: 'u' }));
    loadStyleSheet.mockReturnValue(null);

    invoke('foo');
    invoke('foo');

    expect(fetchBundle).toHaveBeenCalledTimes(1);
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(processEvalResult).toHaveBeenCalledTimes(1);
  });

  test('cache: different urls are not deduped', () => {
    thenMock.mockImplementation((cb) => cb({ code: 0, url: 'u' }));
    loadStyleSheet.mockReturnValue(null);

    invoke('foo');
    invoke('bar');

    expect(fetchBundle).toHaveBeenCalledTimes(2);
    expect(fetchBundle).toHaveBeenNthCalledWith(1, 'foo', {
      isLazyBundle: true,
    });
    expect(fetchBundle).toHaveBeenNthCalledWith(2, 'bar', {
      isLazyBundle: true,
    });
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

  test('cache: a fetchBundle throw is not cached → next prepare retries', () => {
    fetchBundle.mockImplementationOnce(() => {
      throw new Error('net');
    });
    invoke('foo');

    // Second prepare for the same url must retry, not short-circuit.
    thenMock.mockImplementation((cb) => cb({ code: 0, url: 'u' }));
    loadStyleSheet.mockReturnValue(null);
    invoke('foo');

    expect(fetchBundle).toHaveBeenCalledTimes(2);
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(processEvalResult).toHaveBeenCalledTimes(1);
  });

  test('response.code !== 0 → silent skip', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 1, url: 'u' }));

    invoke('foo');

    expect(loadScript).not.toHaveBeenCalled();
    expect(processEvalResult).not.toHaveBeenCalled();
    expect(loadStyleSheet).not.toHaveBeenCalled();
  });

  test('cache: a non-zero response is not cached → next prepare retries', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 1, url: 'u' }));
    invoke('foo');
    expect(loadScript).not.toHaveBeenCalled();

    // The failed load left `foo` uncached, so a retry runs the full prepare.
    thenMock.mockImplementation((cb) => cb({ code: 0, url: 'u' }));
    loadStyleSheet.mockReturnValue(null);
    invoke('foo');

    expect(fetchBundle).toHaveBeenCalledTimes(2);
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(processEvalResult).toHaveBeenCalledTimes(1);
  });

  test('loadScript throws (BG-only bundle) → no handler, no CSS', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadScript.mockImplementationOnce(() => {
      throw new Error('no MTS section');
    });

    expect(() => invoke('foo')).not.toThrow();
    expect(processEvalResult).not.toHaveBeenCalled();
    expect(loadStyleSheet).not.toHaveBeenCalled();
  });

  test('null stylesheet → no AdoptStyleSheet call', () => {
    thenMock.mockImplementationOnce((cb) => cb({ code: 0, url: 'u' }));
    loadStyleSheet.mockReturnValueOnce(null);

    invoke('foo');

    expect(loadStyleSheet).toHaveBeenCalled();
    expect(adoptStyleSheet).not.toHaveBeenCalled();
  });
});
