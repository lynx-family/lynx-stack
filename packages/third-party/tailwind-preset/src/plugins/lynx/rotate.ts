// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cssTransformValue } from './transform.js';
import { createUtilityPlugin } from '../../helpers.js';
/**
 * Base on https://github.com/tailwindlabs/tailwindcss/blob/d1f066d97a30539c1c86aa987c75b6d84ef29609/src/corePlugins.js#L492
 */
export const rotate = createUtilityPlugin(
  'rotate',
  [
    // rotate (Z axis)
    ['rotate', [['@defaults transform', {}], '--tw-rotate', [
      'transform',
      cssTransformValue,
    ]]],
    // rotate-x/y/z
    [
      [
        'rotate-x',
        ['--tw-rotate-x', ['transform', cssTransformValue]],
      ],
      [
        'rotate-y',
        ['--tw-rotate-y', ['transform', cssTransformValue]],
      ],
      [
        'rotate-z',
        ['--tw-rotate', ['transform', cssTransformValue]],
      ],
    ],
  ],
  { supportsNegativeValues: true },
);
