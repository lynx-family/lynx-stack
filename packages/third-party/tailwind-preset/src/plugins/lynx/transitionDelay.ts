// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import {
  TRANSITION_REPEATED_MODIFIER,
  createRepeaterUtility,
} from '../../plugin-utils/index.js';

export const transitionDelay: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    const transitionProps = theme('transitionProperty', '') ?? {};
    const propEntries = Object.entries(transitionProps).filter(
      ([modifier]) => modifier !== 'DEFAULT',
    );
    const propDefault = theme('transitionProperty.DEFAULT', '');

    matchUtilities({
      delay: createRepeaterUtility('transition-delay', { count: 1 }),
      [`delay-${TRANSITION_REPEATED_MODIFIER}`]: createRepeaterUtility(
        'transition-delay',
        {
          matchValue: propDefault,
        },
      ),
      ...Object.fromEntries(
        propEntries.map(([modifier, value]) => [
          `delay-${modifier}`,
          createRepeaterUtility('transition-delay', { matchValue: value }),
        ]),
      ),
    }, {
      values: Object.fromEntries(
        Object.entries(theme('transitionDelay') ?? {}).filter(([modifier]) =>
          modifier !== 'DEFAULT'
        ),
      ),
    });
  },
);
