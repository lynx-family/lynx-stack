// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { boxShadow } from '../../plugins/lynx/boxShadow.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('boxShadow plugin', () => {
  it('registers shadow utilities and transforms values', () => {
    const { api } = runPlugin(boxShadow, {
      theme: {
        boxShadow: {
          sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
          none: 'none',
        },
      },
    });

    const matchUtilities = vi.mocked(api.matchUtilities);
    expect(matchUtilities).toHaveBeenCalledTimes(1);

    const call = matchUtilities.mock.calls[0];
    expect(call).toBeDefined();

    const [utils, options] = call as [
      Record<string, (value: unknown) => Record<string, string> | null>,
      { values: Record<string, string> },
    ];

    expect(options.values).toMatchObject({
      sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
      none: 'none',
    });

    expect(utils['shadow']).toBeDefined();

    expect(utils['shadow']?.('0 1px 2px 0 rgba(0,0,0,0.05)')).toEqual({
      'box-shadow': '0 1px 2px 0 rgba(0,0,0,0.05)',
    });

    expect(utils['shadow']?.('none')).toEqual({
      'box-shadow': 'none',
    });

    // Invalid (function returns non-string)
    expect(utils['shadow']?.(() => 123)).toBeNull();

    // Invalid input types
    expect(utils['shadow']?.(123)).toBeNull();
    expect(utils['shadow']?.(undefined)).toBeNull();
  });
});
