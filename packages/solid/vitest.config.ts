// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [{
      find: /^solid-js$/,
      replacement: fileURLToPath(
        new URL('./node_modules/solid-js/dist/solid.js', import.meta.url),
      ),
    }],
  },
  test: {
    name: 'solid',
    include: ['test/**/*.test.ts'],
    server: {
      deps: {
        inline: [/solid-js/],
      },
    },
  },
});
