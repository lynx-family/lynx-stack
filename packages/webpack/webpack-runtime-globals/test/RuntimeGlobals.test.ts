// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { RuntimeGlobals } from '../src/index.js';

describe('RuntimeGlobals', () => {
  test('not overlap with Rspack', async () => {
    const rspack = await import('@rspack/core');
    Object.keys(RuntimeGlobals).forEach(lynxRuntimeRequirement => {
      expect(rspack.RuntimeGlobals).not.toContain(lynxRuntimeRequirement);
    });
  });
});
