// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import { createFunctionCallUtility } from '../../plugin-utils/create-function-call-utility.js';

export const grayscale: Plugin = createPlugin(({ matchUtilities, theme }) => {
  matchUtilities({
    grayscale: createFunctionCallUtility('filter', 'grayscale', {
      emptyFallback: 'none',
    }),
  }, {
    values: theme('grayscale'),
  });
});
