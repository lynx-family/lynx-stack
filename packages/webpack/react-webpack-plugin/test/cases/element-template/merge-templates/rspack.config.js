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
      compiler.hooks.thisCompilation.tap(
        'element-template-merge-test',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.beforeEncode.tap('element-template-merge-test', (args) => {
            const elementTemplate = args.encodeData.elementTemplate ?? {};
            const templates = JSON.stringify(elementTemplate);

            expect(templates).toContain('main-thread-shell');
            expect(templates).toContain('deferred-content');

            // Both threads compile the shared `<view>` wrapper, and the
            // content-hash id makes that one entry rather than two.
            expect(
              Object.keys(elementTemplate).filter((id) =>
                id !== '_et_builtin_raw_text'
              ),
            ).toHaveLength(3);

            return args;
          });
        },
      );
    },
  ],
};
