// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const textDecoration: Plugin = createPlugin(({ addUtilities }) => {
  addUtilities(
    {
      '.no-underline': {
        'text-decoration': 'none',
      },
      '.line-through': {
        'text-decoration': 'line-through',
      },
      '.underline': {
        'text-decoration': 'underline',
      },
    },
  );
});
