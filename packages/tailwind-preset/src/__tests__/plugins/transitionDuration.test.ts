// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { transitionDuration } from '../../plugins/lynx/transitionDuration.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('transitionDuration plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(transitionDuration, {
      theme: {
        transitionDuration: {
          75: '75ms',
          150: '150ms',
          DEFAULT: '200ms', // will be filtered out
        },
        transitionProperty: {
          DEFAULT: 'background-color, border-color, opacity, transform, color',
          colors: 'color, background-color, border-color',
          visual: 'opacity, background-color, color',
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

    // Invalid input
    expect(utils['duration']?.(null)).toBeNull();
    expect(utils['duration-visual']?.(123)).toBeNull();
    expect(utils['duration-colors']?.(false)).toBeNull();

    // Single duration
    expect(utils['duration']?.('75ms')).toEqual({
      'transition-duration': '75ms',
    });

    // Grouped durations based on number of props: count = 3
    expect(utils['duration-colors']?.('150ms')).toEqual({
      'transition-duration': '150ms, 150ms, 150ms',
    });

    // fallback to empty string group: count = 5
    const result = utils['duration-n']?.('150ms');
    expect(result).toEqual({
      'transition-duration': '150ms, 150ms, 150ms, 150ms, 150ms',
    });
  });
});
