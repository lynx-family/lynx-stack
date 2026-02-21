// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { diagnosticCases } from '@lynx-js/test-tools';

diagnosticCases({
  name: 'externals-loading',
  casePath: path.join(__dirname, 'diagnostic'),
});
