// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { fileURLToPath } from 'node:url';

import type { RsbuildPlugin } from '@rslib/core';

/** Compile Motion's browser globals into imports of the private Lynx runtime. */
export function pluginMotionRuntime(): RsbuildPlugin {
  return {
    name: 'lynx:motion-runtime',
    setup(api) {
      api.modifyRspackConfig((config) => {
        config.module ??= {};
        config.module.rules ??= [];
        config.module.rules.push({
          test: /\.[cm]?js$/,
          include:
            /node_modules[/\\](?:motion|motion-dom|motion-utils|framer-motion)[/\\]/,
          enforce: 'pre',
          loader: fileURLToPath(
            new URL('./runtime-loader.cjs', import.meta.url),
          ),
        });
        // Keep one ElementCompt constructor for both the adapter and vendor code.
        const externals = config.externals
          ? (Array.isArray(config.externals)
            ? config.externals
            : [config.externals])
          : [];
        config.externals = [...externals, {
          'lynx-motion-runtime': '../polyfill/runtime.js',
          'lynx-motion-microtask': '../polyfill/microtask.js',
        }];
      });
    },
  };
}
