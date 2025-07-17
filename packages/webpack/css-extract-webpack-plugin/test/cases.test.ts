// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { describeCases } from '@lynx-js/test-tools';

describeCases({
  name: 'css-extract',
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  casePath: path.join(import.meta.dirname, 'fixtures'),
});
