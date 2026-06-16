// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const LYNX_NODE_ENV = process.env.NODE_ENV === 'development'
  ? 'development'
  : 'production';

export default defineConfig({
  plugins: [
    pluginReactLynx({
      defaultDisplayLinear: false,
      experimental_isLazyBundle: true,
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
      'a2ui-lazy-component': './lynx-src/a2ui-lazy-component/index.tsx',
    },
  },
  environments: {
    web: {},
    lynx: {},
  },
  output: {
    cleanDistPath: false,
    distPath: {
      root: 'www',
    },
    filename: '[name].[platform].bundle',
    minify: false,
  },
});
