// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable @typescript-eslint/unbound-method */

import { createPlugin } from '../../helpers.js';

export const display: void = createPlugin(({ addUtilities, variants }) => {
  addUtilities(
    {
      '.block': { display: 'block' },
      '.flex': { display: 'flex' },
      '.grid': { display: 'grid' },
      '.hidden': { display: 'none' },
      // Below are not supported by Lynx:
      // - anything with 'inline'
      // - anything with 'table'
      // '.inline': { display: 'inline', },
      // '.list-item': { display: 'list-item', },
    },
    variants('display'),
  );
});
