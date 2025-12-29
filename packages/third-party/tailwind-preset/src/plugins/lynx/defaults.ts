// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { cssTransformDefault } from './transform.js';
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const defaults: Plugin = createPlugin(({ addBase }) => {
  addBase(
    {
      '*': {
        ...cssTransformDefault,
        // Lynx does not support Nested CSS Variables, uncomment in the future
        // '--tw-transform': cssTransformValue,
        // '--tw-ring-offset-shadow': '0 0 0 0 transparent',
        // '--tw-ring-shadow': '0 0 0 0 transparent',
        // '--tw-shadow': '0 0 0 0 transparent',
        // '--tw-shadow-colored': '0 0 0 0 transparent',
      },
    },
  );
});
