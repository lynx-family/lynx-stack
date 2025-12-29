// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { transitionDelay } from '../../plugins/lynx/transitionDelay.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('transitionDelay plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(transitionDelay, {
      theme: {
        transitionDelay: {
          100: '100ms',
          200: '200ms',
          DEFAULT: '300ms', // should be filtered out
        },
        transitionProperty: {
          DEFAULT: 'background-color, border-color, opacity, transform, color',
          colors: 'background-color, border-color',
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

    // Invalid types
    expect(utils['delay']?.(null)).toBeNull();
    expect(utils['delay-colors']?.(false)).toBeNull();
    expect(utils['delay-colors']?.(42)).toBeNull();

    // Basic delay
    expect(utils['delay']?.('100ms')).toEqual({
      'transition-delay': '100ms',
    });

    // Group delays based on transitionProperty count
    expect(utils['delay-colors']?.('200ms')).toEqual({
      'transition-delay': '200ms, 200ms',
    });

    expect(utils['delay-n']?.('400ms')).toEqual({
      'transition-delay': '400ms, 400ms, 400ms, 400ms, 400ms',
    });
  });
});
