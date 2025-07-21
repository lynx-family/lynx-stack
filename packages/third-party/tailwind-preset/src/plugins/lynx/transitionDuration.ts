// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import { createRepeaterUtility } from '../../plugin-utils/index.js';

export const transitionDuration: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    const propDefault = theme('transitionProperty.DEFAULT', '');
    const propColors = theme('transitionProperty.colors', '');
    const propVisual = theme('transitionProperty.visual', '');
    const propEffects = theme('transitionProperty.effects', '');

    matchUtilities({
      duration: createRepeaterUtility('transition-duration', { count: 1 }),
      'duration-repeat': createRepeaterUtility('transition-duration', {
        matchValue: propDefault,
      }),
      'duration-colors': createRepeaterUtility('transition-duration', {
        matchValue: propColors,
      }),
      'duration-visual': createRepeaterUtility('transition-duration', {
        matchValue: propVisual,
      }),
      'duration-effects': createRepeaterUtility('transition-duration', {
        matchValue: propEffects,
      }),
    }, {
      values: Object.fromEntries(
        Object.entries(theme('transitionDuration') ?? {}).filter(([modifier]) =>
          modifier !== 'DEFAULT'
        ),
      ),
    });
  },
);
