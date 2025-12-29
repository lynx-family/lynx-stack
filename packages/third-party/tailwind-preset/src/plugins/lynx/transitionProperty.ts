// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import { createRepeaterUtility } from '../../plugin-utils/index.js';

export const transitionProperty: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    const defaultTimingFunction = theme(
      'transitionTimingFunction.DEFAULT',
      'ease', // Lynx default is 'linear' (Web is 'ease'), we use 'ease' for similar DX experience
    );
    const defaultDuration = theme('transitionDuration.DEFAULT', '0s');

    matchUtilities(
      {
        transition: (value: unknown) => {
          if (typeof value !== 'string' || value.trim() === '') {
            return null;
          }

          const base = {
            'transition-property': value,
          };

          const durationRepeater = createRepeaterUtility(
            'transition-duration',
            {
              matchValue: value,
              skipIfSingleProperty: false,
            },
          );

          const timingFunctionRepeater = createRepeaterUtility(
            'transition-timing-function',
            {
              matchValue: value,
              skipIfSingleProperty: false,
            },
          );
          // Generate corresponding duration / timing-function
          const duration = durationRepeater?.(defaultDuration);
          const timing = timingFunctionRepeater?.(defaultTimingFunction);
          return {
            ...base,
            ...(duration ?? {}),
            ...(timing ?? {}),
          };
        },
      },
      { values: theme('transitionProperty') },
    );
  },
);
