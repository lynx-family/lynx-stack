// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  devtool: false,
  mode: 'development',
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      intermediate: '.rspeedy/main',
      // No `lazyBundleFetcher` — defaults to QueryComponent.
    }),
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    (compiler) => {
      compiler.hooks.thisCompilation.tap('strip', (compilation) => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );
        hooks.asyncChunkName.tap(
          'strip',
          (chunkName) =>
            chunkName.replace(':main-thread', '').replace(':background', ''),
        );
      });
    },
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    (compiler) => {
      compiler.hooks.thisCompilation.tap('mark-mt', (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'mark-mt',
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_DERIVED,
          },
          (assets) => {
            for (const name of Object.keys(assets)) {
              if (!name.includes(':main-thread')) continue;
              const asset = compilation.getAsset(name);
              if (!asset) continue;
              compilation.updateAsset(asset.name, asset.source, {
                ...asset.info,
                'lynx:main-thread': true,
              });
            }
          },
        );
      });
    },
  ],
};
