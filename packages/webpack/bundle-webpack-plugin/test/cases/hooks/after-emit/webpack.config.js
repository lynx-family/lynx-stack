import { expect } from 'vitest';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  target: 'node',
  plugins: [
    new LynxTemplatePlugin({ filename: 'main.tasm' }),
    new LynxEncodePlugin(),
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );

        hooks.afterEmit.tap(
          'test',
          ({ outputName }) => {
            expect(outputName).toStrictEqual(
              expect.stringContaining('main.tasm'),
            );
          },
        );
      });
    },
  ],
};
