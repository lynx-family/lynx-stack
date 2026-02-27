// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { transitionProperty } from '../../plugins/lynx/transitionProperty.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('transitionProperty plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(transitionProperty, {
      theme: {
        transitionProperty: {
          none: 'none',
          DEFAULT: 'color, background-color, border-color',
          all: 'all',
        },
        transitionDuration: {
          DEFAULT: '200ms',
        },
        transitionTimingFunction: {
          DEFAULT: 'ease-in-out',
        },
      },
    });

    const matchUtilities = vi.mocked(api.matchUtilities);

    type UtilityFn = (value: unknown) => Record<string, string> | null;

    const utils = matchUtilities.mock.calls.reduce<Record<string, UtilityFn>>(
      (acc, call) => {
        const group = call[0] as Record<string, UtilityFn>;
        for (const key in group) {
          acc[key] = group[key]!;
        }
        return acc;
      },
      {},
    );

    // Invalid inputs
    expect(utils['transition']?.(null)).toBeNull();
    expect(utils['transition']?.(false)).toBeNull();
    expect(utils['transition']?.(123)).toBeNull();

    // Case: uses CSS variable
    expect(utils['transition']?.('var(--tw-property)')).toEqual({
      'transition-property': 'var(--tw-property)',
      'transition-duration': '200ms',
      'transition-timing-function': 'ease-in-out',
    });

    // Case: single property
    expect(utils['transition']?.('opacity')).toEqual({
      'transition-property': 'opacity',
      'transition-duration': '200ms',
      'transition-timing-function': 'ease-in-out',
    });

    // Case: multiple properties
    expect(utils['transition']?.('color, background-color, border-color'))
      .toEqual({
        'transition-property': 'color, background-color, border-color',
        'transition-duration': '200ms, 200ms, 200ms',
        'transition-timing-function': 'ease-in-out, ease-in-out, ease-in-out',
      });

    // Case: extra spaces in value
    expect(utils['transition']?.(' transform , opacity , width  ')).toEqual({
      'transition-property': ' transform , opacity , width  ',
      'transition-duration': '200ms, 200ms, 200ms',
      'transition-timing-function': 'ease-in-out, ease-in-out, ease-in-out',
    });

    // Case: not a plain list of identifiers
    expect(
      utils['transition']?.('x, var(--tw, a, b), y'),
    ).toEqual({
      'transition-property': 'x, var(--tw, a, b), y',
      'transition-duration': '200ms',
      'transition-timing-function': 'ease-in-out',
    });

    // Case: invalid property
    expect(utils['transition']?.('')).toBeNull();

    // Case: invalid duration and timing function
    expect(utils['transition']?.(' , , ')).toEqual({
      'transition-property': ' , , ',
    });
  });
});
