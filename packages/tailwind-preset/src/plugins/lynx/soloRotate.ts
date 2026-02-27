// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import { createFunctionCallUtility } from '../../plugin-utils/index.js';

export const soloRotate: Plugin = createPlugin(({
  matchUtilities,
  theme,
}) => {
  matchUtilities(
    {
      'solo-rotate': createFunctionCallUtility('transform', 'rotate'),
      'solo-rotate-x': createFunctionCallUtility('transform', 'rotateX'),
      'solo-rotate-y': createFunctionCallUtility('transform', 'rotateY'),
      'solo-rotate-z': createFunctionCallUtility('transform', 'rotateZ'),
    },
    {
      supportsNegativeValues: true,
      values: theme('rotate'),
    },
  );
});
