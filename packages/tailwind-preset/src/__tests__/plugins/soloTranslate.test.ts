// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { soloTranslate } from '../../plugins/lynx/soloTranslate.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('soloTranslate plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(soloTranslate, {
      theme: {
        translate: {
          '1': '1rem',
          '40px': '40px',
          full: '100%',
        },
      },
    });

    const matchUtilities = vi.mocked(api.matchUtilities);

    // Build a strictly typed utility map
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

    expect(utils['solo-translate-x']?.(0)).toBeNull();

    expect(utils['solo-translate-x']?.('1rem')).toEqual({
      transform: `translateX(1rem)`,
    });

    expect(utils['solo-translate-y']?.('1rem')).toEqual({
      transform: `translateY(1rem)`,
    });

    expect(utils['solo-translate-z']?.('1rem')).toEqual({
      transform: `translateZ(1rem)`,
    });

    expect(utils['solo-translate-y']?.(undefined)).toBeNull();
    expect(utils['solo-translate-z']?.(null)).toBeNull();
    expect(utils['solo-translate-z']?.('100%')).toBeNull();
  });
});
