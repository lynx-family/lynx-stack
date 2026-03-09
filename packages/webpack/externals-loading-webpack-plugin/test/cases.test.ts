// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { describeCases } from '@lynx-js/test-tools';

describeCases({
  name: 'externals-loading',
  casePath: path.join(__dirname, 'cases'),
  beforeExecute: () => {
    if (lynx[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]) {
      delete lynx[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')];
    }
  },
});

declare global {
  var lynx: Record<symbol, unknown>;
}
