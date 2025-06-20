// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { describe } from 'vitest';

import { diagnosticCases } from '@lynx-js/test-tools';

if (process.platform === 'win32') {
  describe.todo('diagnostic test is not supported on Windows');
} else {
  diagnosticCases({
    name: 'css-extract',
    casePath: path.join(__dirname, 'diagnostic'),
  });
}
