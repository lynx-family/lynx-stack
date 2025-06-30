// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cssTransformValue, cssTransformVarMap } from './transform.js';
import { createUtilityPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const scale: Plugin = createUtilityPlugin('scale', [
  [
    'scale',
    [
      ['@defaults transform', {}],
      cssTransformVarMap.scaleX,
      cssTransformVarMap.scaleY,
      ['transform', cssTransformValue],
    ],
  ],
  [
    ['scale-x', [['@defaults transform', {}], cssTransformVarMap.scaleX, [
      'transform',
      cssTransformValue,
    ]]],
    [
      'scale-y',
      [['@defaults transform', {}], cssTransformVarMap.scaleY, [
        'transform',
        cssTransformValue,
      ]],
    ],
  ],
]);
