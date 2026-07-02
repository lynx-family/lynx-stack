// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    hookTimeout: 180_000,
    include: ['scripts/update-react-fixture-snapshot.vitest.ts'],
    testTimeout: 240_000,
  },
});
