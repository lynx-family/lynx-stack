// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import {
  globalCommitContext,
  resetGlobalCommitContext,
  takeGlobalFlushOptions,
} from '../../src/core/commit-context.js';

describe('globalCommitContext', () => {
  it('resets shared commit state used by snapshot flush options', () => {
    globalCommitContext.ops = ['op'];
    globalCommitContext.flushOptions = { triggerDataUpdated: true };
    globalCommitContext.flowIds = [1, 2];

    expect(takeGlobalFlushOptions()).toEqual({ triggerDataUpdated: true });
    expect(globalCommitContext.flushOptions).toEqual({});

    globalCommitContext.flushOptions = { __lynx_timing_flag: 'timing' };

    resetGlobalCommitContext();

    expect(globalCommitContext.ops).toEqual([]);
    expect(globalCommitContext.flushOptions).toEqual({});
    expect(globalCommitContext.flowIds).toBeUndefined();
  });
});
