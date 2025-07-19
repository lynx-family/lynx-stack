// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { soloRotate } from '../../plugins/lynx/soloRotate.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('soloRotate plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(soloRotate, {
      theme: {
        rotate: {
          '45': '45deg',
          '90': '90deg',
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

    // Invalid input tests
    expect(utils['solo-rotate']?.(null)).toBeNull();
    expect(utils['solo-rotate-x']?.(undefined)).toBeNull();
    expect(utils['solo-rotate-y']?.(0)).toBeNull();
    expect(utils['solo-rotate-z']?.({})).toBeNull();

    // Valid input tests
    expect(utils['solo-rotate']?.('45deg')).toEqual({
      transform: 'rotate(45deg)',
    });

    expect(utils['solo-rotate-x']?.('90deg')).toEqual({
      transform: 'rotateX(90deg)',
    });

    expect(utils['solo-rotate-y']?.('30deg')).toEqual({
      transform: 'rotateY(30deg)',
    });

    expect(utils['solo-rotate-z']?.('60deg')).toEqual({
      transform: 'rotateZ(60deg)',
    });
  });
});
