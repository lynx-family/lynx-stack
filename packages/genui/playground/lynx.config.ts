// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const LYNX_NODE_ENV = process.env.NODE_ENV === 'development'
  ? 'development'
  : 'production';

export default defineConfig({
  dev: {
    hmr: false,
  },
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
    define: {
      'process.env.NODE_ENV': JSON.stringify(LYNX_NODE_ENV),
      'process.env[\'NODE_ENV\']': JSON.stringify(LYNX_NODE_ENV),
    },
    entry: {
      a2ui: './lynx-src/a2ui/index.tsx',
      'mcp-apps': './lynx-src/mcp-apps/index.tsx',
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
