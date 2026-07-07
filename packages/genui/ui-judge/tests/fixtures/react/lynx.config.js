// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const useExternalAssets =
  process.env.LYNX_HEADLESS_RUST_EXTERNAL_ASSETS === '1';
const fixtureDir = dirname(fileURLToPath(import.meta.url));
const externalAssetPrefix = `${
  pathToFileURL(resolve(fixtureDir, '.generated')).href
}/`;

export default defineConfig({
  source: {
    entry: './src/index.jsx',
  },
  plugins: [
    pluginReactLynx(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
  output: {
    assetPrefix: useExternalAssets ? externalAssetPrefix : undefined,
    dataUriLimit: useExternalAssets ? 0 : Number.POSITIVE_INFINITY,
    distPath: {
      root: '.generated',
    },
  },
});
