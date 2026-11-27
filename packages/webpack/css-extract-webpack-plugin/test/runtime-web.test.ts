// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { createStubLynx } from './helper/stubLynx.js';
import update from '../runtime/hotModuleReplacement.cjs';

// A web bundle has no runtime wrapper, so there is no `lynx.__chunk_entries__`.
describe('HMR Runtime without lynx.__chunk_entries__', () => {
  test('dispatches only the update of the card\'s chunk, without an entry', () => {
    const dispatchEvent = rstest.fn<(event: unknown) => void>();
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
    rstest.useFakeTimers();

    update('', null, 10)();
    rstest.runAllTimers();

    // The update of an async chunk would replace the style sheets of the card.
    expect(lynx['requireModuleAsync']).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls.map(([event]) => event)).toEqual([
      {
        type: 'lynx.hmr.css',
        data: { cssId: 10, content: '/foo.css', deps: {}, entry: undefined },
      },
    ]);
  });
});
