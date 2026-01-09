// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const display: Plugin = createPlugin(({ addUtilities }) => {
  addUtilities(
    {
      '.flex': { display: 'flex' },
      '.grid': { display: 'grid' },
      '.hidden': { display: 'none' },
      '.display-relative': { display: 'relative' },
      '.linear': { display: 'linear' },
      // Below are not supported by Lynx:
      // '.block': { display: 'block' },
      // - anything with 'inline'
      // - anything with 'table'
      // '.inline': { display: 'inline', },
      // '.list-item': { display: 'list-item', },
    },
  );
});
