/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { fileURLToPath } from 'node:url';
import { LynxTemplatePlugin, WebEncodePlugin } from '../../../../lib/index.js';

const section = (assetName) => assetName.split('/')[0];

/** @type {import('@rspack/core').Configuration} */
export default {
  entry: {
    a: './a.js',
    b: './b.js',
    a__main_thread: './a.js',
    b__main_thread: './b.js',
    test: './test.js',
  },
  context: fileURLToPath(new URL('.', import.meta.url)),
  output: {
    filename: '[name]/[name].js',
  },
  plugins: [
    new WebEncodePlugin({
      cardType: 'react',
    }),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['a', 'b', 'a__main_thread', 'b__main_thread'],
      excludeChunks: ['test'],
      filename: 'bundle/template.js',
      intermediate: '.rspeedy/bundle',
      appType: 'DynamicComponent',
      customSectionNaming: () => ({
        mainThread: section,
        background: (manifestKey) => section(manifestKey.replace(/^\//, '')),
        css: () => undefined,
      }),
    }),

    compiler => {
      compiler.hooks.thisCompilation.tap('test', (compilation) => {
        compilation.hooks.processAssets.tap('test', () => {
          ['a__main_thread', 'b__main_thread'].forEach(name => {
            const asset = compilation.getAsset(`${name}/${name}.js`);
            compilation.updateAsset(asset.name, asset.source, {
              ...asset.info,
              'lynx:main-thread': true,
            });
          });
        });
      });
    },
  ],
};
