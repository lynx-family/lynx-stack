// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import { createRepeaterUtility } from '../../plugin-utils/index.js';

export const transitionTimingFunction: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    const propDefault = theme('transitionProperty.DEFAULT', '');
    const propColors = theme('transitionProperty.colors', '');
    const propVisual = theme('transitionProperty.visual', '');
    const propEffects = theme('transitionProperty.effects', '');

    matchUtilities({
      ease: createRepeaterUtility('transition-timing-function', { count: 1 }),
      'ease-repeat': createRepeaterUtility('transition-timing-function', {
        matchValue: propDefault,
      }),
      'ease-colors': createRepeaterUtility('transition-timing-function', {
        matchValue: propColors,
      }),
      'ease-visual': createRepeaterUtility(
        'transition-timing-function',
        { matchValue: propVisual },
      ),
      'ease-effects': createRepeaterUtility(
        'transition-timing-function',
        { matchValue: propEffects },
      ),
    }, {
      values: Object.fromEntries(
        Object.entries(theme('transitionTimingFunction') ?? {}).filter((
          [modifier],
        ) => modifier !== 'DEFAULT'),
      ),
    });
  },
);
