// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
import { createMainThreadGlobalAPIs } from '../ts/client/mainthread/createMainThreadGlobalAPIs.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';

function createLynx() {
  rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
  const loadScript = rstest.fn<(url: string) => Promise<unknown>>();
  const loadScriptSync = rstest.fn();
  const { lynx } = createMainThreadGlobalAPIs({
    templateUrl: 'main.bundle',
    backgroundThread: { markTiming: rstest.fn() },
    i18nManager: { _I18nResourceTranslation: rstest.fn() },
    lepusCodeUrls: new Map([
      ['main.bundle', { section: 'blob:main' }],
      ['external.bundle', { section: 'blob:external' }],
    ]),
    mtsRealm: { loadScript, loadScriptSync },
  } as unknown as LynxViewInstance);
  return { lynx, loadScript, loadScriptSync };
}

describe('main-thread loadScriptAsync', () => {
  afterEach(() => rstest.unstubAllGlobals());
  test.each([
    { entryName: undefined, blobUrl: 'blob:main' },
    { entryName: 'external.bundle', blobUrl: 'blob:external' },
  ])(
    'loads the section asynchronously from $blobUrl',
    async ({ entryName, blobUrl }) => {
      const { lynx, loadScript, loadScriptSync } = createLynx();
      let finish!: (value: unknown) => void;
      loadScript.mockReturnValue(
        new Promise(resolve => {
          finish = resolve;
        }),
      );
      const callback = rstest.fn();
      expect(lynx.loadScriptAsync!('section', callback, entryName))
        .toBeUndefined();
      expect(loadScript).toHaveBeenCalledWith(blobUrl);
      expect(loadScriptSync).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      const exports = { value: 42 };
      finish(exports);
      await Promise.resolve();
      expect(callback).toHaveBeenCalledExactlyOnceWith(null, exports);
    },
  );

  test.each(['missing.bundle', 'external.bundle'])(
    'reports a missing section in %s through the callback',
    entryName => {
      const { lynx, loadScript, loadScriptSync } = createLynx();
      const callback = rstest.fn();
      lynx.loadScriptAsync!('missing', callback, entryName);
      expect(callback).toHaveBeenCalledExactlyOnceWith(
        `lynx.loadScriptAsync: section "missing" not found in bundle ${entryName}`,
      );
      expect(loadScript).not.toHaveBeenCalled();
      expect(loadScriptSync).not.toHaveBeenCalled();
    },
  );

  test('reports asynchronous loading errors through the callback', async () => {
    const { lynx, loadScript, loadScriptSync } = createLynx();
    loadScript.mockRejectedValue(new Error('script failed'));
    const callback = rstest.fn();
    lynx.loadScriptAsync!('section', callback, 'external.bundle');
    await Promise.resolve();
    expect(callback).toHaveBeenCalledExactlyOnceWith('Error: script failed');
    expect(loadScriptSync).not.toHaveBeenCalled();
  });
});
