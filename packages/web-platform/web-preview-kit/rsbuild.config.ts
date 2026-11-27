// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module';
import path from 'node:path';

import { defineConfig } from '@rsbuild/core';

import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';

const require = createRequire(import.meta.url);

/**
 * The `dist/` of `@lynx-js/web-bundle-kit`, which the bundler worker imports
 * at run time from `bundle-kit/` next to it.
 */
const bundleKitDist = path.join(
  path.dirname(require.resolve('@lynx-js/web-bundle-kit/package.json')),
  'dist',
);

export default defineConfig({
  output: {
    overrideBrowserslist: ['Chrome >= 118'],
    sourceMap: { js: 'source-map' },
  },
  tools: {
    rspack: {
      // Sources import each other with `.js`, as TypeScript's NodeNext does.
      resolve: { extensionAlias: { '.js': ['.ts', '.js'] } },
    },
  },
  environments: {
    // The page. `dist/kit/index.html`.
    kit: {
      source: { entry: { index: './src/page/index.ts' } },
      html: { template: './src/page/index.html' },
      output: {
        target: 'web',
        distPath: { root: 'dist/kit' },
        assetPrefix: './',
      },
      tools: {
        rspack: {
          resolve: { fallback: { module: false } },
          output: { publicPath: 'auto' },
        },
      },
      plugins: [pluginWebPlatform({ polyfill: false })],
    },
    // The bundler worker and the Service Worker, as module scripts with fixed
    // names next to the page: `bundler-worker.js` and `sw.js`.
    workers: {
      source: {
        entry: {
          'bundler-worker': './src/worker/bundler-worker.ts',
          sw: './src/sw/service-worker.ts',
        },
      },
      output: {
        target: 'web-worker',
        module: true,
        distPath: { root: 'dist/kit', js: '' },
        filename: { js: '[name].js' },
        cleanDistPath: false,
        assetPrefix: './',
        // Copied as it is: minifying it would rename the placeholders of the
        // runtime templates that the plugins stringify, such as
        // `$installedChunks$` in the chunk loading HMR runtime.
        copy: [{
          from: bundleKitDist,
          to: 'bundle-kit',
          info: { minimized: true },
        }],
      },
      performance: { chunkSplit: { strategy: 'all-in-one' } },
    },
  },
});
