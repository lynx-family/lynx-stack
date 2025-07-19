// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import {
  createFunctionCallUtility,
  withStringGuard,
} from '../../plugin-utils/index.js';
import type { KeyValuePair } from '../../types/tailwind-types.js';

export const soloTranslate: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    matchUtilities(
      {
        'solo-translate-x': withStringGuard(
          createFunctionCallUtility('transform', 'translateX'),
        ),
        'solo-translate-y': withStringGuard(
          createFunctionCallUtility('transform', 'translateY'),
        ),
        'solo-translate-z': withStringGuard((value) => {
          // Prevent use of percent values for translateZ
          if (value.includes('%')) return null;
          return { transform: `translateZ(${value})` };
        }),
      },
      {
        supportsNegativeValues: true,
        values: theme('translate') as KeyValuePair,
      },
    );
  },
);
