// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { cssTransformValue, transform } from '../../plugins/lynx/transform.js';
import type { CSSRuleObject } from '../../types/tailwind-types.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('transform plugin', () => {
  it('registers base transform utilities', () => {
    const { api } = runPlugin(transform);

    const addUtilities = vi.mocked(api.addUtilities);
    expect(addUtilities).toHaveBeenCalledTimes(1);

    const addUtilitiesCall = addUtilities.mock.calls[0];
    if (!addUtilitiesCall) throw new Error('addUtilities not called');
    const [baseUtils] = addUtilitiesCall as [Record<string, CSSRuleObject>];

    expect(baseUtils).toMatchObject({
      '.transform': { transform: cssTransformValue },
      '.transform-cpu': { transform: cssTransformValue },
      '.transform-gpu': { transform: cssTransformValue },
      '.transform-none': { transform: 'none' },
    });
  });

  it('supports arbitrary transform values', () => {
    const { api } = runPlugin(transform);

    const matchUtilities = vi.mocked(api.matchUtilities);
    const utils: Record<string, (value: unknown) => unknown> = {};

    for (const call of matchUtilities.mock.calls) {
      const [group] = call as [Record<string, (value: unknown) => unknown>];
      for (const key in group) {
        const fn = group[key];
        if (typeof fn === 'function') {
          utils[key] = fn;
        }
      }
    }

    expect(utils['transform']?.('rotate(45deg)')).toEqual({
      transform: 'rotate(45deg)',
    });

    expect(utils['transform']?.('translate3d(0,0,0)')).toEqual({
      transform: 'translate3d(0,0,0)',
    });

    // Invalid values
    expect(utils['transform']?.(null)).toBeNull();
    expect(utils['transform']?.(123)).toBeNull();
    expect(utils['transform']?.(false)).toBeNull();
  });
});
