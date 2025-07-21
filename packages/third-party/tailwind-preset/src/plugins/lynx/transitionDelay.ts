// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import { createRepeaterUtility } from '../../plugin-utils/index.js';

export const transitionDelay: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    const propDefault = theme('transitionProperty.DEFAULT', '');
    const propColors = theme('transitionProperty.colors', '');
    const propVisual = theme('transitionProperty.visual', '');
    const propEffects = theme('transitionProperty.effects', '');

    matchUtilities({
      delay: createRepeaterUtility('transition-delay', { count: 1 }),
      'delay-repeat': createRepeaterUtility('transition-delay', {
        matchValue: propDefault,
      }),
      'delay-colors': createRepeaterUtility('transition-delay', {
        matchValue: propColors,
      }),
      'delay-visual': createRepeaterUtility('transition-delay', {
        matchValue: propVisual,
      }),
      'delay-effects': createRepeaterUtility('transition-delay', {
        matchValue: propEffects,
      }),
    }, {
      values: Object.fromEntries(
        Object.entries(theme('transitionDelay') ?? {}).filter(([modifier]) =>
          modifier !== 'DEFAULT'
        ),
      ),
    });
  },
);
