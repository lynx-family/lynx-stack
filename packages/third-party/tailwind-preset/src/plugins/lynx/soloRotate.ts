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

export const soloRotate: Plugin = createPlugin(({
  matchUtilities,
  theme,
}) => {
  matchUtilities(
    {
      'solo-rotate': withStringGuard(
        createFunctionCallUtility('transform', 'rotate'),
      ),
      'solo-rotate-x': withStringGuard(
        createFunctionCallUtility('transform', 'rotateX'),
      ),
      'solo-rotate-y': withStringGuard(
        createFunctionCallUtility('transform', 'rotateY'),
      ),
      'solo-rotate-z': withStringGuard(
        createFunctionCallUtility('transform', 'rotateZ'),
      ),
    },
    {
      supportsNegativeValues: true,
      values: theme('rotate') as KeyValuePair,
    },
  );
});
