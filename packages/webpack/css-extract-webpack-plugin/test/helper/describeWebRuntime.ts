// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { createStubLynx } from './stubLynx.js';

/**
 * Tests the CSS HMR runtime without `lynx.__chunk_entries__`, as on web, where
 * it takes the entry from lynx-core's global `globDynamicComponentEntry` when
 * the runtime module is evaluated.
 *
 * Call it once per test file: the runtime module is evaluated once per file.
 * `loadRuntime` must import `'../runtime/hotModuleReplacement.cjs'` from the
 * test file, the request `rstest.config.ts` loads natively.
 */
export function describeWebRuntime(
  entry: string,
  loadRuntime: () => Promise<
    { default: typeof import('../../runtime/hotModuleReplacement.cjs') }
  >,
): void {
  describe(`HMR Runtime without lynx.__chunk_entries__, as entry ${entry}`, () => {
    test('updates only the template\'s own chunk', async () => {
      const dispatchEvent = rstest.fn();
      const lynx = createStubLynx(
        rstest,
        (content: string) => ({ content, deps: {} }),
        rstest.fn(),
      ) as Record<string, unknown>;
      delete lynx['__chunk_entries__'];
      lynx['getCoreContext'] = () => ({ dispatchEvent });
      rstest.stubGlobal('lynx', lynx);
      rstest.stubGlobal('__webpack_require__', {
        p: '/',
        cssHotUpdateList: [
          ['asyncChunkName', 'async.bar.css'],
          ['chunkName', 'foo.css'],
        ],
      });
      rstest.stubGlobal('globDynamicComponentEntry', entry);
      const { default: update } = await loadRuntime();
      // lynx-core restores the global once the template's code has run.
      rstest.stubGlobal('globDynamicComponentEntry', '__Card__');
      rstest.useFakeTimers();

      update('', null, 10)();
      rstest.runAllTimers();

      expect(lynx['requireModuleAsync']).toHaveBeenCalledTimes(1);
      expect(lynx['requireModuleAsync']).toHaveBeenCalledWith(
        '/foo.css',
        expect.any(Function),
      );
      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      expect(dispatchEvent).toHaveBeenCalledWith({
        type: 'lynx.hmr.css',
        data: { cssId: 10, content: '/foo.css', deps: {}, entry },
      });
    });
  });
}
