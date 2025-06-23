// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cssTransformValue } from './transform.js';
import { createUtilityPlugin } from '../../helpers.js';

export const scale = createUtilityPlugin('scale', [
  [
    'scale',
    [
      ['@defaults transform', {}],
      '--tw-scale-x',
      '--tw-scale-y',
      ['transform', cssTransformValue],
    ],
  ],
  [
    ['scale-x', [['@defaults transform', {}], '--tw-scale-x', [
      'transform',
      cssTransformValue,
    ]]],
    [
      'scale-y',
      [['@defaults transform', {}], '--tw-scale-y', [
        'transform',
        cssTransformValue,
      ]],
    ],
  ],
]);
