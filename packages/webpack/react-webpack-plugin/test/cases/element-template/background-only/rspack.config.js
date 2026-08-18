import { expect } from '@rstest/core';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig(
  {
    experimental_useElementTemplate: true,
  },
  {
    experimental_useElementTemplate: true,
  },
);

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
      let encoded = false;

      compiler.hooks.afterEmit.tap('background-only-element-template', () => {
        expect(encoded).toBe(true);
      });

      compiler.hooks.thisCompilation.tap(
        'background-only-element-template',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.beforeEncode.tap('background-only-element-template', (args) => {
            encoded = true;
            const templates = JSON.stringify(args.encodeData.elementTemplate);

            expect(templates).toContain('fallback-content');
            expect(templates).toContain('deferred-content');

            return args;
          });
        },
      );
    },
  ],
};
