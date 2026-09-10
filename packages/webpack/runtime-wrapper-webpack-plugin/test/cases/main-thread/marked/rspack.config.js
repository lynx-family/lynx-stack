/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { RuntimeWrapperWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  output: {
    chunkFilename: 'main-thread.js',
  },
  plugins: [
    new RuntimeWrapperWebpackPlugin(),
    {
      name: 'MarkMainThread',
      apply(compiler) {
        compiler.hooks.thisCompilation.tap('MarkMainThread', (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'MarkMainThread',
              stage:
                compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            () => {
              const asset = compilation.getAsset('main-thread.js');
              compilation.updateAsset(asset.name, asset.source, {
                ...asset.info,
                'lynx:main-thread': true,
              });
            },
          );
        });
      },
    },
  ],
};
