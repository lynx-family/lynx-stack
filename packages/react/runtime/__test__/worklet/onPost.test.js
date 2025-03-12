// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onPostWorkletCtx } from '../../src/worklet/ctx';
import { destroyWorklet } from '../../src/worklet/destroy';

afterEach(() => {
  destroyWorklet();
});

describe('WorkletOnPost', () => {
  it('error when sdk version not fulfilled', async function() {
    lynx.getCoreContext = undefined;
    const reportError = lynx.reportError;
    lynx.reportError = vi.fn();

    expect(onPostWorkletCtx({
      _wkltId: '835d:450ef:1',
    })).toBeNull();

    expect(lynx.reportError).toHaveBeenCalledTimes(1);
    lynx.reportError = reportError;
  });

  it('should return when worklet is null', async function() {
    expect(onPostWorkletCtx(null)).toBeNull();
  });
});
