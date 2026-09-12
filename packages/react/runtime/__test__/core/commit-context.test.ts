// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it } from '@rstest/core';

import {
  globalCommitContext,
  resetGlobalCommitContext,
  takeGlobalFlushOptions,
} from '../../src/core/commit-context.js';

describe('globalCommitContext', () => {
  beforeEach(() => {
    resetGlobalCommitContext();
  });

  it('takes flush options and clears the global slot', () => {
    globalCommitContext.flushOptions = { triggerDataUpdated: true };

    const flushOptions = takeGlobalFlushOptions();

    expect(flushOptions).toEqual({ triggerDataUpdated: true });
    expect(globalCommitContext.flushOptions).toEqual({});
  });

  it('resets payload state', () => {
    globalCommitContext.ops = ['op'];
    globalCommitContext.flushOptions = { __lynx_timing_flag: 'timing' };
    globalCommitContext.flowIds = [1, 2];

    resetGlobalCommitContext();

    expect(globalCommitContext.ops).toEqual([]);
    expect(globalCommitContext.flushOptions).toEqual({});
    expect(globalCommitContext.flowIds).toBeUndefined();
  });
});
