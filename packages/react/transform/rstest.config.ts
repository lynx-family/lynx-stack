/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  name: 'react/transform',
  include: ['__test__/**/*.spec.{js,ts}'],
  coverage: {
    exclude: ['./__test__/*.bench.js'],
  },
});
