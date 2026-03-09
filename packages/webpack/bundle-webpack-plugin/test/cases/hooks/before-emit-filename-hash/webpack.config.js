import { expect } from 'vitest';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  target: 'node',
  plugins: [
    new LynxTemplatePlugin({
      filename: '[name].template.[contenthash:8].js',
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
            expect(outputName).toMatch(/main\.template\.[0-9a-fA-F]{8}\.js/);

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
