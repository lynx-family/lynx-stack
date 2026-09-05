// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, rs } from '@rstest/core';
import { options } from 'preact';

import { DIFFED } from '../../../src/shared/render-constants';
import { initRenderAlog } from '../../../src/snapshot/alog/render';

describe('initRenderAlog', () => {
  it('logs nothing when neither thread flag is set', () => {
    const previousDiffed = options[DIFFED];
    const previousAlog = console.alog;
    const previousMainThread = globalThis.__MAIN_THREAD__;
    const previousBackground = globalThis.__BACKGROUND__;
    const alog = rs.fn();
    console.alog = alog;
    globalThis.__MAIN_THREAD__ = false;
    globalThis.__BACKGROUND__ = false;

    try {
      // Install onto an empty chain so the surrounding profile hooks, which
      // expect a matching `profileStart`, are not invoked by this direct call.
      options[DIFFED] = undefined;
      initRenderAlog();
      options[DIFFED]!({ type: function Foo() {} } as never);

      expect(alog).not.toHaveBeenCalled();
    } finally {
      options[DIFFED] = previousDiffed;
      console.alog = previousAlog;
      globalThis.__MAIN_THREAD__ = previousMainThread;
      globalThis.__BACKGROUND__ = previousBackground;
    }
  });
});
