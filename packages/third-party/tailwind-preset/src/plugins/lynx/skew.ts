// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { cssTransformValue, cssTransformVarMap } from './transform.js';
import { createUtilityPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const skew: Plugin = createUtilityPlugin(
  'skew',
  [
    [
      ['skew-x', [cssTransformVarMap.skewX, [
        'transform',
        cssTransformValue,
      ]]],
      ['skew-y', [cssTransformVarMap.skewY, [
        'transform',
        cssTransformValue,
      ]]],
    ],
  ],
  { supportsNegativeValues: true },
);
