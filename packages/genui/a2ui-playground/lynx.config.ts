// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        return {
          default: `${url}?fullscreen=true`,
        };
      },
    }),
    pluginReactLynx({
      defaultDisplayLinear: false,
    }),
  ],
  source: {
    entry: {
      main: './lynx-src/index.tsx',
    },
  },
  environments: {
    web: {},
    lynx: {},
  },
  output: {
    distPath: {
      root: 'www',
    },
    filename: '[name].[platform].js',
  },
});
