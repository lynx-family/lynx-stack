// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@lynx-js/rspeedy'
import { pluginVueLynx } from '@lynx-js/vue-rsbuild-plugin'

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  plugins: [
    pluginVueLynx({
      optionsApi: false, // demo uses Composition API only → smaller bundle
    }),
  ],
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
})
