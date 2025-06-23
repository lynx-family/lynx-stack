// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { cssTransformValue } from './transform.js';
import { createUtilityPlugin } from '../../helpers.js';

export const skew = createUtilityPlugin(
  'skew',
  [
    [
      ['skew-x', [['@defaults transform', {}], '--tw-skew-x', [
        'transform',
        cssTransformValue,
      ]]],
      ['skew-y', [['@defaults transform', {}], '--tw-skew-y', [
        'transform',
        cssTransformValue,
      ]]],
    ],
  ],
  { supportsNegativeValues: true },
);
