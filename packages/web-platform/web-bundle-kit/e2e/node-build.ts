// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Builds a project in Node.js with the configuration the kit gives it in
// src/bundler.ts, with the plugins as published: the reference the kit's
// output is compared with in development.spec.ts.

import { createRsbuild } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

export interface NodeBuildOptions {
  /** The project. */
  root: string;
  /** The cards, by name. */
  entries: Record<string, string>;
  outDir: string;
  publicPath: string;
  mode: 'development' | 'production';
  hmr: boolean;
}

export async function buildInNode(
  { root, entries, outDir, publicPath, mode, hmr }: NodeBuildOptions,
): Promise<void> {
  const rsbuild = await createRsbuild({
    cwd: root,
    loadEnv: false,
    config: {
      mode,
      // Only problems: the test output stays quiet on success.
      logLevel: 'warn',
      source: {
        entry: Object.fromEntries(
          Object.entries(entries).map(([name, entry]) => [name, `./${entry}`]),
        ),
      },
      environments: { web: {} },
      output: {
        distPath: { root: outDir },
        assetPrefix: publicPath,
        cleanDistPath: true,
        polyfill: 'off',
        charset: 'utf8',
      },
      dev: {
        hmr,
        liveReload: hmr,
        assetPrefix: publicPath,
        progressBar: false,
      },
      server: { host: 'localhost', printUrls: false },
      performance: { printFileSize: false, buildCache: false },
      splitChunks: false,
      tools: {
        bundlerChain(chain) {
          chain.plugins.delete('lynx.hmr.provide.dev_server_client');
        },
      },
      plugins: [pluginLynx(), pluginReactLynx()],
    },
  });
  await rsbuild.build();
}
