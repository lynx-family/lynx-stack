import { expect } from '@rstest/core';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  target: 'node',
  plugins: [
    new LynxTemplatePlugin({
      filename: '[name].template.js',
    }),
    new LynxEncodePlugin(),
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );

        hooks.beforeEmit.tap(
          'test',
          ({ debugInfo, mainThreadAssets, outputName, template }) => {
            expect(outputName).toBe('main.template.js');

            return {
              template,
              mainThreadAssets,
              debugInfo,
            };
          },
        );
      });
    },
  ],
};
