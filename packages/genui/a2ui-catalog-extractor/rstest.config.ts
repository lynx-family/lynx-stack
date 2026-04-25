// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

export default defineConfig({
  name: 'genui/a2ui-catalog-extractor',
  globals: true,
  include: ['test/**/*.test.ts'],
});
