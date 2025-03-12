// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createStubLynx } from './helper/stubLynx.js';
import update from '../runtime/hotModuleReplacement.cjs';

describe('HMR Runtime', () => {
  const replaceStyleSheetByIdWithBase64 = vi.fn();

  const lynx = createStubLynx(
    vi,
    (content: string) => ({ content, deps: [] }),
    replaceStyleSheetByIdWithBase64,
  );

  vi.stubGlobal('lynx', lynx);

  lynx.__chunk_entries__ = {
    'chunkName': 'entry',
    'asyncChunkName': 'asyncEntry',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('cssFileName not provided', () => {
    vi.stubGlobal('__webpack_require__', {});
    vi.useFakeTimers();

    const cssReload = update('', null, 10);

    cssReload();

    // debounce
    expect(vi.getTimerCount()).toBe(1);

    expect(() => vi.runAllTimers()).toThrowErrorMatchingInlineSnapshot(
      `[Error: cssHotUpdateList is not found]`,
    );
  });

  test('cssFileName', () => {
    vi.stubGlobal('__webpack_require__', {
      p: '/',
      cssHotUpdateList: [['chunkName', 'foo.css']],
    });
    vi.useFakeTimers();

    const cssReload = update('', null, 10);

    cssReload();

    // debounce
    vi.runAllTimers();

    expect(lynx.requireModuleAsync).toBeCalled();

    expect(lynx.requireModuleAsync).toBeCalledWith(
      expect.stringContaining('/foo.css'),
      expect.any(Function),
    );
  });

  test('update', async () => {
    await import('../runtime/hotModuleReplacement.lepus.cjs');
    vi.stubGlobal('__webpack_require__', {
      p: '/',
      cssHotUpdateList: [['chunkName', 'foo.css']],
    });
    const __FlushElementTree = vi.fn();
    vi.stubGlobal('__FlushElementTree', __FlushElementTree);
    vi.useFakeTimers();

    const cssReload = update('', null, 10);

    cssReload();

    // debounce
    vi.runAllTimers();

    // requireModuleAsync
    await vi.runAllTimersAsync();

    expect(replaceStyleSheetByIdWithBase64).toBeCalled();
    expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
      10,
      expect.stringContaining('/foo.css'),
      'entry',
    );

    expect(__FlushElementTree).toBeCalled();
  });

  test('update without cssId', async () => {
    await import('../runtime/hotModuleReplacement.lepus.cjs');
    vi.stubGlobal('__webpack_require__', {
      p: '/',
      cssHotUpdateList: [['chunkName', 'bar.css']],
    });
    const __FlushElementTree = vi.fn();
    vi.stubGlobal('__FlushElementTree', __FlushElementTree);
    vi.useFakeTimers();

    const cssReload = update('', null);

    cssReload();

    // debounce
    vi.runAllTimers();

    // requireModuleAsync
    await vi.runAllTimersAsync();

    expect(replaceStyleSheetByIdWithBase64).toBeCalled();
    expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
      0,
      expect.stringContaining('/bar.css'),
      'entry',
    );

    expect(__FlushElementTree).toBeCalled();
  });

  test('update with publicPath', async () => {
    await import('../runtime/hotModuleReplacement.lepus.cjs');
    vi.stubGlobal('__webpack_require__', {
      p: 'https://example.com/',
      cssHotUpdateList: [['chunkName', 'bar.css']],
    });
    const __FlushElementTree = vi.fn();
    vi.stubGlobal('__FlushElementTree', __FlushElementTree);
    vi.useFakeTimers();

    const cssReload = update('', null);

    cssReload();

    // debounce
    vi.runAllTimers();

    // requireModuleAsync
    await vi.runAllTimersAsync();

    expect(replaceStyleSheetByIdWithBase64).toBeCalled();
    expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
      0,
      expect.stringContaining('https://example.com/bar.css'),
      'entry',
    );

    expect(__FlushElementTree).toBeCalled();
  });

  test('update lazy bundle', async () => {
    await import('../runtime/hotModuleReplacement.lepus.cjs');
    vi.stubGlobal('__webpack_require__', {
      p: '/',
      cssHotUpdateList: [['asyncChunkName', 'async.bar.css'], [
        'chunkName',
        'foo.css',
      ]],
    });
    const __FlushElementTree = vi.fn();
    vi.stubGlobal('__FlushElementTree', __FlushElementTree);
    vi.useFakeTimers();

    const cssReload = update('', null);

    cssReload();

    // debounce
    vi.runAllTimers();

    // requireModuleAsync
    await vi.runAllTimersAsync();

    expect(replaceStyleSheetByIdWithBase64).toBeCalledTimes(2);

    expect(replaceStyleSheetByIdWithBase64).toHaveBeenNthCalledWith(
      1,
      0,
      expect.stringContaining('async.bar.css'),
      'asyncEntry',
    );

    expect(replaceStyleSheetByIdWithBase64).toHaveBeenNthCalledWith(
      2,
      0,
      expect.stringContaining('foo.css'),
      'entry',
    );

    expect(__FlushElementTree).toBeCalled();
  });
});
