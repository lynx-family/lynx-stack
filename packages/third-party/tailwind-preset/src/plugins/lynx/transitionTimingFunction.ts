// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import {
  TRANSITION_REPEATED_MODIFIER,
  createRepeaterUtility,
} from '../../plugin-utils/index.js';

export const transitionTimingFunction: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    const transitionProps = theme('transitionProperty', '') ?? {};

    const propEntries = Object.entries(transitionProps).filter(
      ([modifier]) => modifier !== 'DEFAULT',
    );
    const propDefault = theme('transitionProperty.DEFAULT', '');

    matchUtilities({
      ease: createRepeaterUtility('transition-timing-function', { count: 1 }),
      [`ease-${TRANSITION_REPEATED_MODIFIER}`]: createRepeaterUtility(
        'transition-timing-function',
        {
          matchValue: propDefault,
        },
      ),
      // automatic register other transitionProperty modifiers
      ...Object.fromEntries(
        propEntries.map(([modifier, value]) => [
          `ease-${modifier}`,
          createRepeaterUtility('transition-timing-function', {
            matchValue: value,
          }),
        ]),
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
