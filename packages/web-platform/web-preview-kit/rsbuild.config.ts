// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, logger } from '@rsbuild/core';

import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * The bundler worker imports `@lynx-js/web-bundle-kit` at run time from
 * `bundle-kit/` next to it (see `src/worker/bundler-worker.ts`), so its
 * `dist/` is copied there as it is. Without a `dist/` the kit still builds;
 * its `hello` then says it cannot build.
 */
function copyBundleKit(): {
  from: string;
  to: string;
  info: { minimized: boolean };
}[] {
  const dist = path.join(
    path.dirname(require.resolve('@lynx-js/web-bundle-kit/package.json')),
    'dist',
  );
  if (existsSync(path.join(dist, 'index.js'))) {
    // Copied as it is: minifying it would rename the placeholders of the
    // runtime templates that the plugins stringify, such as
    // `$installedChunks$` in the chunk loading HMR runtime.
    return [{ from: dist, to: 'bundle-kit', info: { minimized: true } }];
  }
  logger.warn(
    `@lynx-js/web-bundle-kit has no ${
      path.relative(root, dist)
    }/index.js; the kit is built without it and reports that it cannot build.`,
  );
  return [];
}

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
  dev: {
    hmr: false,
    liveReload: false,
    writeToDisk: true,
  },
  environments: {
    // The page a host embeds. `dist/kit/index.html`.
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
        copy: copyBundleKit(),
      },
      performance: { chunkSplit: { strategy: 'all-in-one' } },
    },
    // The demo host. `dist/demo/index.html`.
    demo: {
      source: { entry: { index: './demo/main.ts' } },
      html: { template: './demo/index.html' },
      output: {
        target: 'web',
        distPath: { root: 'dist/demo' },
        assetPrefix: './',
      },
    },
  },
});
