// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { cssTransformValue } from '../../plugins/lynx/transform.js';
import { translate } from '../../plugins/lynx/translate.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('translate plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(translate, {
      theme: {
        translate: {
          '1': '1rem',
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

    expect(utils['translate-x']?.(0)).toBeNull();

    expect(utils['translate-x']?.('1rem')).toEqual({
      '--tw-tx': '1rem',
      transform: cssTransformValue,
    });

    expect(utils['translate-y']?.('1rem')).toEqual({
      '--tw-ty': '1rem',
      transform: cssTransformValue,
    });

    expect(utils['translate-z']?.('1rem')).toEqual({
      '--tw-tz': '1rem',
      transform: cssTransformValue,
    });

    expect(utils['translate-y']?.(undefined)).toBeNull();
    expect(utils['translate-z']?.(null)).toBeNull();
    expect(utils['translate-z']?.('100%')).toBeNull();
  });
});
