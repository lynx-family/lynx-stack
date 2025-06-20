// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createUtilityPlugin } from '../../helpers.js';

/**
 * Base on https://github.com/tailwindlabs/tailwindcss/blob/d1f066d97a30539c1c86aa987c75b6d84ef29609/src/corePlugins.js#L492
 */
export const rotate = createUtilityPlugin(
  'rotate',
  [
    ['rotate', ['--tw-rotate', ['transform', 'rotate(var(--tw-rotate))']]],
    [
      [
        'rotate-x',
        ['--tw-rotate-x', ['transform', 'rotateX(var(--tw-rotate-x))']],
      ],
      [
        'rotate-y',
        ['--tw-rotate-y', ['transform', 'rotateY(var(--tw-rotate-y))']],
      ],
    ],
  ],
  { supportsNegativeValues: true },
);
