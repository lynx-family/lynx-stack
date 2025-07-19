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

export const soloSkew: Plugin = createPlugin(({
  matchUtilities,
  theme,
}) => {
  matchUtilities(
    {
      'solo-skew': withStringGuard(
        createFunctionCallUtility('transform', 'skew'),
      ),
      'solo-skew-x': withStringGuard(
        createFunctionCallUtility('transform', 'skewX'),
      ),
      'solo-skew-y': withStringGuard(
        createFunctionCallUtility('transform', 'skewY'),
      ),
    },
    {
      supportsNegativeValues: true,
      values: theme('skew') as KeyValuePair,
    },
  );
});
