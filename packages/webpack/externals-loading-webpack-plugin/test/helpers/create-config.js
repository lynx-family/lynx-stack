// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ExternalsLoadingPlugin } from '../../src';

/**
 * @param {string=} name - The name
 * @param {string=} source - The source path
 * @returns {Record<string, import('@rspack/core').EntryDescription>} - The react entries.
 */
export function createEntries(name = 'main', source = './index.js') {
  return {
    [`${name}:main-thread`]: {
      layer: 'main-thread',
      import: source,
    },
    [`${name}:background`]: {
      layer: 'background',
      import: source,
    },
  };
}

/**
 * @param {import('../../src').ExternalsLoadingPluginOptions} externalsLoadingPluginOptions ExternalsLoadingPlugin options
 * @param {import("@rspack/core").Configuration['externals']} externals rspack externals config
 *
 * @returns {import("@rspack/core").Configuration} The default Rspack configuration.
 */
export function createConfig(externalsLoadingPluginOptions, externals = {}) {
  return {
    entry: createEntries(),
    experiments: {
      layers: true,
    },
    externals,
    plugins: [
      new ExternalsLoadingPlugin(
        externalsLoadingPluginOptions,
      ),
    ],
    output: {
      filename: '[name].js',
    },
  };
}
