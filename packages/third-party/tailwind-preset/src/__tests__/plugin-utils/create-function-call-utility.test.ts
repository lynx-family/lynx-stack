// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { createFunctionCallUtility } from '../../plugin-utils/create-function-call-utility.js';

describe('createFunctionCallUtility', () => {
  it('generates correct CSS rule', () => {
    const fn = createFunctionCallUtility('transform', 'scale');
    expect(fn('1.5')).toEqual({ transform: 'scale(1.5)' });
  });

  it('allows empty string', () => {
    const fn = createFunctionCallUtility('transform', 'rotate');
    expect(fn('')).toEqual({ transform: 'rotate()' });
  });
});
