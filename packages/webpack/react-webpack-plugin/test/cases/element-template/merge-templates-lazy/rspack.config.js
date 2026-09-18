import { expect } from '@rstest/core';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const config = createConfig(
  {
    experimental_useElementTemplate: true,
  },
  {
    experimental_useElementTemplate: true,
    mainThreadChunks: [
      'main__main-thread.js',
      '.rspeedy/lazy-bundle/lazy.jsx/main-thread.js',
    ],
  },
);

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...config,
  plugins: [
    ...config.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
    }),
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    (compiler) => {
      let encodedMainTemplate = false;

      compiler.hooks.afterEmit.tap('element-template-lazy-scope-test', () => {
        expect(encodedMainTemplate).toBe(true);
      });

      compiler.hooks.thisCompilation.tap(
        'element-template-lazy-scope-test',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.beforeEncode.tap('element-template-lazy-scope-test', (args) => {
            const isMainTemplate = args.chunkGroups.some(
              (chunkGroup) => chunkGroup.name === 'main__main-thread',
            );
            if (isMainTemplate) {
              encodedMainTemplate = true;
              const templates = JSON.stringify(args.encodeData.elementTemplate);

              expect(templates).toContain('main-bundle-content');
              expect(templates).not.toContain('lazy-only-content');
            }

            return args;
          });
        },
      );
    },
  ],
};
