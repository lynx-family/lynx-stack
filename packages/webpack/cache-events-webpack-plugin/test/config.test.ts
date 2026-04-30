// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { fileURLToPath } from 'node:url';

import { createNormalCase, describeByWalk } from '@rspack/test-tools';

const __filename = fileURLToPath(import.meta.url);

describeByWalk(__filename, (name, src, dist) => {
  createNormalCase(name, src, dist);
});
