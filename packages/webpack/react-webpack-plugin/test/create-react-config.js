// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { rspack } from '@rspack/core';

import { LAYERS, ReactWebpackPlugin } from '../src';

/**
 * @param {string=} name - The name
 * @param {string=} source - The source path
 * @returns {Record<string, import('@rspack/core').EntryDescription>} - The react entries.
 */
export function createEntries(name = 'main', source = './index.js') {
  return {
    [`${name}:main-thread`]: {
      layer: LAYERS.MAIN_THREAD,
      import: source,
    },
    [`${name}:background`]: {
      layer: LAYERS.BACKGROUND,
      import: source,
    },
  };
}

/**
 * @param {'BACKGROUND' | 'MAIN_THREAD'} layer - The layer of ReactWebpackPlugin.
 * @param {import('../src').ReactLoaderOptions=} options - THe options of the loader.
 * @returns {import('@rspack/core').RuleSetRule} The module.rules
 */
function createRuleFor(layer, options) {
  return {
    test: /\.[jt]sx?$/,
    issuerLayer: LAYERS[layer],
    use: [
      {
        loader: ReactWebpackPlugin.loaders[layer],
        options,
      },
    ],
  };
}

/**
 * @param {import('../src').ReactLoaderOptions=} options - THe options of the loader.
 * @param {import("@rspack/core").SwcLoaderOptions=} swcLoaderOptions - The options for swc-loader.
 * @returns {import('@rspack/core').RuleSetRule[]} The module.rules
 */
function createReactRules(options, swcLoaderOptions = {
  jsc: {
    parser: {
      syntax: 'typescript',
      decorators: true,
    },
  },
}) {
  return [
    {
      test: /\.[jt]sx?$/,
      loader: 'builtin:swc-loader',
      options: swcLoaderOptions,
    },
    createRuleFor('BACKGROUND', options),
    createRuleFor('MAIN_THREAD', options),
  ];
}

/**
 * @param {import('../src').ReactLoaderOptions=} loaderOptions - The options for loader
 * @param {import('../src').ReactWebpackPluginOptions=} pluginOptions - The options for plugin
 * @param {import("@rspack/core").SwcLoaderOptions=} swcLoaderOptions - The options for swc-loader.
 * @returns {import("@rspack/core").Configuration} The default Rspack configuration.
 */
export function createConfig(loaderOptions, pluginOptions, swcLoaderOptions) {
  return {
    entry: createEntries(),
    module: {
      rules: createReactRules(loaderOptions, swcLoaderOptions),
    },
    experiments: {
      layers: true,
    },
    resolve: {
      extensionAlias: {
        '.js': ['.js', '.ts', '.jsx'],
      },
    },
    output: {
      filename: '[name].js',
    },
    plugins: [
      new ReactWebpackPlugin({
        mainThreadChunks: ['main:main-thread.js'],
        ...pluginOptions,
      }),
      /**
       * @param {import('@rspack/core').Compiler} compiler
       */
      (compiler) => {
        new compiler.webpack.BannerPlugin({
          banner: `var globDynamicComponentEntry;`,
          raw: true,
          test: /background\.js$/,
        }).apply(compiler);
      },
    ],
    optimization: {
      chunkIds: 'named',
      moduleIds: 'named',
      minimizer: [
        new rspack.SwcJsMinimizerRspackPlugin({
          minimizerOptions: {
            mangle: {
              toplevel: true,
            },
          },
        }),
      ],
    },
  };
}
