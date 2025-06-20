// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createUtilityPlugin } from '../../helpers.js';

export const scale = createUtilityPlugin('scale', [
  [
    'scale',
    [
      '--tw-scale-x',
      '--tw-scale-y',
      ['transform', 'scale(var(--tw-scale-x), var(--tw-scale-y))'],
    ],
  ],
  [
    ['scale-x', ['--tw-scale-x', ['transform', 'scaleX(var(--tw-scale-x))']]],
    ['scale-y', ['--tw-scale-y', ['transform', 'scaleY(var(--tw-scale-y))']]],
  ],
]);
