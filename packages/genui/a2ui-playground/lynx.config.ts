// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
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
    pluginLynxConfig({
      enableCSSInlineVariables: true,
    }),
  ],
  source: {
    entry: {
      a2ui: './lynx-src/a2ui/index.tsx',
      openui: './lynx-src/openui/index.tsx',
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
    minify: false,
  },
});
