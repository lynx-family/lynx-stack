// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';

import { createStubLynx } from './helper/stubLynx.js';
import update from '../runtime/hotModuleReplacement.cjs';

describe('HMR Runtime', () => {
  const replaceStyleSheetByIdWithBase64 = rstest.fn();

  const lynx = createStubLynx(
    rstest,
    (content: string) => ({ content, deps: [] }),
    replaceStyleSheetByIdWithBase64,
  );

  rstest.stubGlobal('lynx', lynx);

  lynx.__chunk_entries__ = {
    'chunkName': 'entry',
    'asyncChunkName': 'asyncEntry',
  };

  // rstest types `beforeEach` (and `clearAllMocks`) as promise-returning;
  // nothing to await here (registration/reset are effectively synchronous).
  void beforeEach(() => {
    void rstest.clearAllMocks();
  });

  test('cssFileName not provided', () => {
    rstest.stubGlobal('__webpack_require__', {});
    rstest.useFakeTimers();

    const cssReload = update('', null, 10);

    cssReload();

    // debounce
    expect(rstest.getTimerCount()).toBe(1);

    expect(() => rstest.runAllTimers()).toThrowErrorMatchingInlineSnapshot(
      `[Error: cssHotUpdateList is not found]`,
    );
  });

  test('cssFileName', () => {
    rstest.stubGlobal('__webpack_require__', {
      p: '/',
      cssHotUpdateList: [['chunkName', 'foo.css']],
    });
    rstest.useFakeTimers();

    const cssReload = update('', null, 10);

    cssReload();

    // debounce
    rstest.runAllTimers();

    expect(lynx.requireModuleAsync).toBeCalled();

    expect(lynx.requireModuleAsync).toBeCalledWith(
      expect.stringContaining('/foo.css'),
      expect.any(Function),
    );
  });

  test('update', async () => {
    await import('../runtime/hotModuleReplacement.lepus.cjs');
    rstest.stubGlobal('__webpack_require__', {
      p: '/',
      cssHotUpdateList: [['chunkName', 'foo.css']],
    });
    const __FlushElementTree = rstest.fn();
    rstest.stubGlobal('__FlushElementTree', __FlushElementTree);
    rstest.useFakeTimers();

    const cssReload = update('', null, 10);

    cssReload();

    // debounce
    rstest.runAllTimers();

    // requireModuleAsync
    await rstest.runAllTimersAsync();

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
    rstest.stubGlobal('__webpack_require__', {
      p: '/',
      cssHotUpdateList: [['chunkName', 'bar.css']],
    });
    const __FlushElementTree = rstest.fn();
    rstest.stubGlobal('__FlushElementTree', __FlushElementTree);
    rstest.useFakeTimers();

    const cssReload = update('', null);

    cssReload();

    // debounce
    rstest.runAllTimers();

    // requireModuleAsync
    await rstest.runAllTimersAsync();

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
    rstest.stubGlobal('__webpack_require__', {
      p: 'https://example.com/',
      cssHotUpdateList: [['chunkName', 'bar.css']],
    });
    const __FlushElementTree = rstest.fn();
    rstest.stubGlobal('__FlushElementTree', __FlushElementTree);
    rstest.useFakeTimers();

    const cssReload = update('', null);

    cssReload();

    // debounce
    rstest.runAllTimers();

    // requireModuleAsync
    await rstest.runAllTimersAsync();

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
    rstest.stubGlobal('__webpack_require__', {
      p: '/',
      cssHotUpdateList: [['asyncChunkName', 'async.bar.css'], [
        'chunkName',
        'foo.css',
      ]],
    });
    const __FlushElementTree = rstest.fn();
    rstest.stubGlobal('__FlushElementTree', __FlushElementTree);
    rstest.useFakeTimers();

    const cssReload = update('', null);

    cssReload();

    // debounce
    rstest.runAllTimers();

    // requireModuleAsync
    await rstest.runAllTimersAsync();

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
