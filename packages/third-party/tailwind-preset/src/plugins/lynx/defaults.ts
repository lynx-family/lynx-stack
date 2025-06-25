// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
// import { cssTransformValue } from './transform.js';

export const defaults = createPlugin(({ addBase }) => {
  addBase(
    {
      ':root': {
        '--tw-translate-x': '0',
        '--tw-translate-y': '0',
        '--tw-translate-z': '0',
        '--tw-rotate-x': '0',
        '--tw-rotate-y': '0',
        '--tw-rotate': '0',
        '--tw-skew-x': '0',
        '--tw-skew-y': '0',
        '--tw-scale-x': '1',
        '--tw-scale-y': '1',
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
