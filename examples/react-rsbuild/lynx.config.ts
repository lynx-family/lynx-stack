// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// An existing Rspeedy project keeps its `lynx.config.ts` unchanged; the
// `rsbuild.config.ts` next to it loads this via `loadLynxConfig()` and hands it
// to `pluginLynxPreset()`, so building with the Rsbuild CLI needs no config
// rewrite.
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
});
