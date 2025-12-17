// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createUtilityPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const inset: Plugin = createUtilityPlugin(
  'inset',
  [
    // 'inset' shorthand is not supported by Lynx, replace with 'left', 'right', 'top', 'bottom'
    // ['inset', ['inset']],
    ['inset', ['left', 'right', 'top', 'bottom']],
    [
      ['inset-x', ['left', 'right']],
      ['inset-y', ['top', 'bottom']],
    ],
    [
      ['start', ['inset-inline-start']],
      ['end', ['inset-inline-end']],
      ['top', ['top']],
      ['right', ['right']],
      ['bottom', ['bottom']],
      ['left', ['left']],
    ],
  ],
  { supportsNegativeValues: true },
);
