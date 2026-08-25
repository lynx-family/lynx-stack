import { expect } from '@rstest/core';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig(undefined, {
  experimental_lynxGroupModuleSharing: true,
});

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...defaultConfig,
  plugins: [
    ...(defaultConfig.plugins ?? []),
    new LynxTemplatePlugin(),
    new LynxEncodePlugin(),
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    (compiler) => {
      compiler.hooks.thisCompilation.tap(
        'lynx-group-module-sharing-test',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.beforeEncode.tap('lynx-group-module-sharing-test', (args) => {
            expect(
              args.encodeData.sourceContent.config.enableLynxGroupModuleSharing,
            )
              .toBe(true);
            return args;
          });
        },
      );
    },
  ],
};
