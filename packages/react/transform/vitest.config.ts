/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import codspeed from '@codspeed/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'react/transform',
    coverage: {
      exclude: ['./__test__/*.bench.js'],
    },
  },
  plugins: [
    process.env['CI'] ? codspeed() : undefined,
  ],
});
