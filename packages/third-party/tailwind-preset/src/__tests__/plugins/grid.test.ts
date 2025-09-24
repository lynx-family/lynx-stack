// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { gridColumn } from '../../plugins/lynx/gridColumn.js';
import { gridRow } from '../../plugins/lynx/gridRow.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('gridRow plugin', () => {
  it('registers utilities correctly', () => {
    const { api } = runPlugin(gridRow, {
      theme: {
        gridRow: {
          '1': '1',
          '2 / 4': '2 / 4',
          'span-full': '1 / -1',
        },
      },
      config: {
        prefix: 'tw-',
      },
    });

    const matchUtilities = vi.mocked(api.matchUtilities);
    expect(matchUtilities).toHaveBeenCalledTimes(1);

    const [utils, options] = matchUtilities.mock.calls[0] as [
      Record<string, (value: unknown) => Record<string, string> | null>,
      { values: Record<string, string> },
    ];

    expect(options.values).toMatchObject({
      '1': '1',
      '2 / 4': '2 / 4',
      'span-full': '1 / -1',
    });

    expect(utils['row']?.('2 / 4')).toEqual({
      gridRowStart: '2',
      gridRowEnd: '4',
    });

    expect(utils['row']?.('1')).toEqual({
      gridRowStart: '1',
      gridRowEnd: '1',
    });

    expect(utils['row']?.('1 / -1')).toEqual({
      gridRowStart: '1',
      gridRowEnd: '-1',
    });

    expect(utils['row']?.(123)).toBeNull();
    expect(utils['row']?.(undefined)).toBeNull();
  });
});

describe('gridColumn plugin', () => {
  it('registers utilities correctly', () => {
    const { api } = runPlugin(gridColumn, {
      theme: {
        gridColumn: {
          '1': '1',
          '2 / 4': '2 / 4',
          'span-full': '1 / -1',
        },
      },
      config: {
        prefix: 'tw-',
      },
    });

    const matchUtilities = vi.mocked(api.matchUtilities);
    expect(matchUtilities).toHaveBeenCalledTimes(1);

    const [utils, options] = matchUtilities.mock.calls[0] as [
      Record<string, (value: unknown) => Record<string, string> | null>,
      { values: Record<string, string> },
    ];

    expect(options.values).toMatchObject({
      '1': '1',
      '2 / 4': '2 / 4',
      'span-full': '1 / -1',
    });

    expect(utils['col']?.('1')).toEqual({
      gridColumnStart: '1',
      gridColumnEnd: '1',
    });

    expect(utils['col']?.('2 / 4')).toEqual({
      gridColumnStart: '2',
      gridColumnEnd: '4',
    });

    expect(utils['col']?.('1 / -1')).toEqual({
      gridColumnStart: '1',
      gridColumnEnd: '-1',
    });

    expect(utils['col']?.(123)).toBeNull();
    expect(utils['col']?.(undefined)).toBeNull();
  });
});
