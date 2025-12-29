// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { blur } from '../../plugins/lynx/blur.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('blur plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(blur, {
      theme: {
        blur: {
          sm: '4px',
          none: '',
          lg: '16px',
        },
      },
    });

    const matchUtilities = vi.mocked(api.matchUtilities);

    type UtilityFn = (value: unknown) => Record<string, string> | null;

    const utils = matchUtilities.mock.calls.reduce<Record<string, UtilityFn>>(
      (acc, call) => {
        const group = call[0] as Record<string, UtilityFn>;
        for (const key in group) {
          if (group[key]) {
            acc[key] = group[key]!;
          }
        }
        return acc;
      },
      {},
    );

    // Invalid inputs
    expect(utils['blur']?.(null)).toBeNull();
    expect(utils['blur']?.(undefined)).toBeNull();
    expect(utils['blur']?.(false)).toBeNull();
    expect(utils['blur']?.(123)).toBeNull();

    // Valid inputs
    expect(utils['blur']?.('')).toEqual({
      filter: 'none',
    });

    expect(utils['blur']?.('4px')).toEqual({
      filter: 'blur(4px)',
    });

    expect(utils['blur']?.('  ')).toEqual({
      filter: 'none',
    });

    expect(utils['blur']?.('16px')).toEqual({
      filter: 'blur(16px)',
    });

    expect(utils['blur']?.('8px')).toEqual({
      filter: 'blur(8px)',
    });
  });
});
