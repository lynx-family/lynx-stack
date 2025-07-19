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

export const soloScale: Plugin = createPlugin(({
  matchUtilities,
  theme,
}) => {
  matchUtilities(
    {
      'solo-scale': withStringGuard(
        createFunctionCallUtility('transform', 'scale'),
      ),
      'solo-scale-x': withStringGuard(
        createFunctionCallUtility('transform', 'scaleX'),
      ),
      'solo-scale-y': withStringGuard(
        createFunctionCallUtility('transform', 'scaleY'),
      ),
    },
    {
      supportsNegativeValues: true,
      values: theme('scale') as KeyValuePair,
    },
  );
});
