// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import { createFunctionCallUtility } from '../../plugin-utils/create-function-call-utility.js';

export const blur: Plugin = createPlugin(({ matchUtilities, theme }) => {
  matchUtilities(
    {
      blur: createFunctionCallUtility('filter', 'blur', {
        emptyFallback: 'none',
      }),
    },
    {
      values: theme('blur'),
    },
  );
});
