// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rstest/core';

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'genui/lynx-xml',
  globals: true,
  include: ['test/**/*.test.ts'],
  output: {
    bundleDependencies: ['@lynx-js/skill-vanilla-lynx'],
  },
  tools: {
    rspack: {
      module: {
        rules: [
          {
            test: /\.md$/,
            resourceQuery: /raw/,
            type: 'asset/source',
          },
        ],
      },
    },
  },
});

export default config;
