// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { pluginPreactLynx } from '@lynx-js/preact-runtime/plugin';
import { defineConfig } from '@lynx-js/rspeedy';

// Benchmark cases mirroring benchmark/react scenarios on the transform-free
// preact runtime, so benchx can compare the two implementations.
export default defineConfig({
  source: {
    entry: {
      '002-hello-preact': './cases/002-hello-preact/index.tsx',
      '007-four-layer-views-preact':
        './cases/007-four-layer-views-preact/index.tsx',
      '008-many-use-state-preact':
        './cases/008-many-use-state-preact/index.tsx',
    },
  },
  output: {
    filename: {
      bundle: '[name].[platform].bundle',
    },
  },
  plugins: [
    pluginPreactLynx(),
  ],
  environments: {
    lynx: {},
  },
});
