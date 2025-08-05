// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import { createFunctionCallUtility } from '../../plugin-utils/index.js';

export const soloTranslate: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    matchUtilities(
      {
        'solo-translate-x': createFunctionCallUtility(
          'transform',
          'translateX',
        ),
        'solo-translate-y': createFunctionCallUtility(
          'transform',
          'translateY',
        ),
        'solo-translate-z': (value: unknown) => {
          // Prevent use of percent values for translateZ
          if (typeof value === 'string' && value.includes('%')) return null;
          return createFunctionCallUtility('transform', 'translateZ')(value);
        },
      },
      {
        supportsNegativeValues: true,
        values: theme('translate'),
      },
    );
  },
);
