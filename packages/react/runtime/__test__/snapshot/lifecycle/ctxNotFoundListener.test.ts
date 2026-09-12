// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import { removeCtxNotFoundEventListener } from '../../../src/snapshot/lifecycle/patch/error';

describe('removeCtxNotFoundEventListener', () => {
  it('is a no-op once the listener has already been removed', () => {
    removeCtxNotFoundEventListener();

    expect(() => removeCtxNotFoundEventListener()).not.toThrow();
  });
});
