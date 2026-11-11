import { expect } from '@rstest/core';

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...defaultConfig,
  plugins: [
    ...defaultConfig.plugins,
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    compiler => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );
        compilation.hooks.processAssets.tapPromise('test', async () => {
          const asset = compilation.getAsset('main__main-thread.js');
          expect(asset).not.toBe(undefined);
          await hooks.beforeEncode.promise({
            chunkGroups: compilation.chunkGroups,
            encodeData: {
              lepusCode: {
                root: asset,
                chunks: [],
              },
              sourceContent: {
                appType: 'card',
              },
            },
          });
        });
      });
    },
  ],
};
