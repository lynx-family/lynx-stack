// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { rspack } from '@rspack/core';
import { expect, it } from '@rstest/core';

import { generateFromTemplate } from '../src/runtime/helper.js';
import hmrLoadManifestRuntime from '../src/runtime/javascript/hmr-load-manifest.js';

it.each(['hook', 'fallback'])(
  'loads the manifest through the %s and preserves its result and errors',
  async mode => {
    const manifest = { c: ['main'], r: ['removed'] };
    let failure: Error & { code?: string } | null = null;
    const calls: string[] = [];
    const load = (
      url: string,
      callback: (error: Error | null, result?: unknown) => void,
    ) => {
      calls.push(url);
      callback(failure, manifest);
    };
    const lynx = {
      requireModuleAsync(
        this: unknown,
        url: string,
        callback: Parameters<typeof load>[1],
      ) {
        expect(mode).toBe('fallback');
        expect(this).toBe(lynx);
        load(url, callback);
      },
    };
    const download = runInNewContext(
      `${
        generateFromTemplate(rspack, hmrLoadManifestRuntime)
      }\n__webpack_require__.hmrM;`,
      {
        __webpack_require__: {
          p: 'http://localhost/',
          hmrF: () => 'main.old.hot-update.json',
          ...(mode === 'hook' ? { lynxHMRLoad: load } : {}),
        },
        lynx,
      },
    ) as () => Promise<typeof manifest | undefined>;

    expect(await download()).toBe(manifest);
    failure = new Error('manifest unavailable');
    await expect(download()).rejects.toBe(failure);
    failure.code = 'MODULE_NOT_FOUND';
    expect(await download()).toBeUndefined();
    expect(calls).toEqual(
      Array(3).fill('http://localhost/main.old.hot-update.json'),
    );
  },
);
