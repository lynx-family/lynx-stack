// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rsbuild/core';

import { pluginLynxPreset } from '@lynx-js/preset-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginLynxPreset(),
    pluginReactLynx(),
    pluginQRCode({
      fullscreen: true,
    }),
  ],
  environments: {
    web: {},
    lynx: {},
  },
  source: {
    // Align with the Rspeedy default entry name (`main`).
    entry: {
      main: './src/index.tsx',
    },
  },
});
