// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { transitionTimingFunction } from '../../plugins/lynx/transitionTimingFunction.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('transitionTimingFunction plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(transitionTimingFunction, {
      theme: {
        transitionTimingFunction: {
          linear: 'linear',
          ease: 'ease',
          'ease-in': 'ease-in',
          DEFAULT: 'ease-in-out', // will be filtered out
        },
        transitionProperty: {
          DEFAULT: 'background-color, border-color, opacity, transform, color',
          colors: 'color, background-color',
          effects: 'filter, box-shadow',
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

    // Invalid values
    expect(utils['ease']?.(false)).toBeNull();
    expect(utils['ease-colors']?.(null)).toBeNull();
    expect(utils['ease-colors']?.(123)).toBeNull();

    // Single value
    expect(utils['ease']?.('linear')).toEqual({
      'transition-timing-function': 'linear',
    });

    // Group repetition
    expect(utils['ease-colors']?.('ease-in')).toEqual({
      'transition-timing-function': 'ease-in, ease-in',
    });

    expect(utils['ease-effects']?.('ease-out')).toEqual({
      'transition-timing-function': 'ease-out, ease-out',
    });

    expect(utils['ease-n']?.('ease')).toEqual({
      'transition-timing-function': 'ease, ease, ease, ease, ease',
    });
  });
});
