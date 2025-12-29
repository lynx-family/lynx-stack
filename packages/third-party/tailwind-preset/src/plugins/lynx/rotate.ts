// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cssTransformValue, cssTransformVarMap } from './transform.js';
import { createUtilityPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

/**
 * Base on https://github.com/tailwindlabs/tailwindcss/blob/d1f066d97a30539c1c86aa987c75b6d84ef29609/src/corePlugins.js#L492
 */
export const rotate: Plugin = createUtilityPlugin(
  'rotate',
  [
    // rotate (Z axis)
    ['rotate', [cssTransformVarMap.rotateZ, [
      'transform',
      cssTransformValue,
    ]]],
    // rotate-x/y/z
    [
      [
        'rotate-x',
        [cssTransformVarMap.rotateX, ['transform', cssTransformValue]],
      ],
      [
        'rotate-y',
        [cssTransformVarMap.rotateY, ['transform', cssTransformValue]],
      ],
      [
        'rotate-z',
        [cssTransformVarMap.rotateZ, ['transform', cssTransformValue]],
      ],
    ],
  ],
  { supportsNegativeValues: true },
);
