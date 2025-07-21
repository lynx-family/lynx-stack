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

  it('handles special characters in input', () => {
    const fn = createFunctionCallUtility('transform', 'translate');
    expect(fn('calc(50% - 10px)')).toEqual({
      transform: 'translate(calc(50% - 10px))',
    });

    expect(fn(' 10px ')).toEqual({
      transform: 'translate( 10px )',
    });

    expect(fn('var(--tw-my-var)')).toEqual({
      transform: 'translate(var(--tw-my-var))',
    });
  });

  it('works with different CSS properties', () => {
    const filterFn = createFunctionCallUtility('filter', 'blur');
    expect(filterFn('5px')).toEqual({ filter: 'blur(5px)' });

    const clipPathFn = createFunctionCallUtility('clip-path', 'path');
    expect(clipPathFn('M0,0 L10,10')).toEqual({
      'clip-path': 'path(M0,0 L10,10)',
    });
  });
});
