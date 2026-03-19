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

  it('returns null on empty string by default', () => {
    const fn = createFunctionCallUtility('transform', 'rotate');
    expect(fn('')).toBeNull();
    expect(fn('   ')).toBeNull();
  });

  it('returns fallback on empty string when provided', () => {
    const fn = createFunctionCallUtility('transform', 'rotate', {
      emptyFallback: 'none',
    });
    expect(fn('')).toEqual({ transform: 'none' });
    expect(fn('   ')).toEqual({ transform: 'none' });
  });

  it('trims surrounding whitespace by default', () => {
    const fn = createFunctionCallUtility('transform', 'translate');
    expect(fn(' 10px ')).toEqual({ transform: 'translate(10px)' });
    expect(fn('\t20%  \n')).toEqual({ transform: 'translate(20%)' });
  });

  it('handles complex values with parentheses and variables', () => {
    const fn = createFunctionCallUtility('transform', 'translate');
    expect(fn('calc(50% - 10px)')).toEqual({
      transform: 'translate(calc(50% - 10px))',
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

  it('returns null on non-string input', () => {
    const fn = createFunctionCallUtility('transform', 'rotate');
    expect(fn(null)).toBeNull();
    expect(fn(undefined)).toBeNull();
    expect(fn(42 as any)).toBeNull();
    expect(fn({} as any)).toBeNull();
  });
});
