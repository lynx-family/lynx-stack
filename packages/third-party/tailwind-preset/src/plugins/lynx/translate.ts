// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cssTransformValue } from './transform.js';
import { createUtilityPlugin } from '../../helpers.js';
/**
 * Base on https://github.com/tailwindlabs/tailwindcss/blob/d1f066d97a30539c1c86aa987c75b6d84ef29609/src/corePlugins.js#L476
 */
export const translate = createUtilityPlugin(
  'translate',
  [
    [
      [
        'translate-x',
        [['@defaults transform', {}], '--tw-translate-x', [
          'transform',
          cssTransformValue,
        ]],
      ],
      [
        'translate-y',
        [['@defaults transform', {}], '--tw-translate-y', [
          'transform',
          cssTransformValue,
        ]],
      ],
      [
        'translate-z',
        [['@defaults transform', {}], '--tw-translate-z', [
          'transform',
          cssTransformValue,
        ]],
      ],
    ],
  ],
  { supportsNegativeValues: true },
);
