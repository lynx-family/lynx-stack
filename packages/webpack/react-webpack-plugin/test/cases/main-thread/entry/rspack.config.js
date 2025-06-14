import { expect } from 'vitest';

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
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
        compilation.hooks.processAssets.tap('test', () => {
          const asset = compilation.getAsset('main__main-thread.js');
          expect(asset).not.toBe(undefined);
          hooks.beforeEncode.promise({
            encodeData: {
              lepusCode: {
                root: asset,
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
