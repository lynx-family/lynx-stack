// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import type { Plugin } from '../../helpers.js';
import { rotate } from '../../plugins/lynx/rotate.js';
import { scale } from '../../plugins/lynx/scale.js';
import { skew } from '../../plugins/lynx/skew.js';
import { cssTransformValue } from '../../plugins/lynx/transform.js';
import { runPlugin } from '../utils/run-plugin.js';

type UtilityFn = (value: unknown) => Record<string, string> | null;

/**
 * Collects the utility generators registered through `matchUtilities` so a
 * plugin's declarations can be composed without running the Tailwind CLI.
 */
function getUtilities(
  plugin: Plugin,
  theme: Record<string, unknown>,
): Record<string, UtilityFn> {
  const { api } = runPlugin(plugin, { theme });

  return vi.mocked(api.matchUtilities).mock.calls.reduce<
    Record<string, UtilityFn>
  >(
    (utilities, call) => ({
      ...utilities,
      ...(call[0] as Record<string, UtilityFn>),
    }),
    {},
  );
}

/**
 * Unit coverage for declaration-level composition across transform plugins.
 *
 * The test combines the objects returned by the Skew, Scale, and Rotate
 * utility generators. CLI generation is covered in `config.test.ts`; runtime
 * rendering is outside this suite.
 */
describe('skew plugin', () => {
  it('composes both skew axes with scale and rotate', () => {
    const skewUtilities = getUtilities(skew, {
      skew: { 6: '6deg', 12: '12deg' },
    });
    const scaleUtilities = getUtilities(scale, {
      scale: { 95: '.95' },
    });
    const rotateUtilities = getUtilities(rotate, {
      rotate: { 45: '45deg' },
    });

    expect({
      ...(skewUtilities['skew-x']?.('12deg') ?? {}),
      ...(skewUtilities['skew-y']?.('6deg') ?? {}),
      ...(scaleUtilities['scale']?.('.95') ?? {}),
      ...(rotateUtilities['rotate']?.('45deg') ?? {}),
    }).toEqual({
      '--tw-skx': '12deg',
      '--tw-sky': '6deg',
      '--tw-sx': '.95',
      '--tw-sy': '.95',
      '--tw-rz': '45deg',
      transform: cssTransformValue,
    });
  });
});
