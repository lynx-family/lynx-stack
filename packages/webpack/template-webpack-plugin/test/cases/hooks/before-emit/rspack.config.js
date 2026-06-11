import { LynxTemplatePlugin, LynxEncodePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  target: 'node',
  plugins: [
    new LynxTemplatePlugin(),
    new LynxEncodePlugin(),
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );

        hooks.beforeEmit.tap(
          'test',
          ({ debugInfo, mainThreadAssets }) => {
            return {
              template: Buffer.from('Hello BeforeEmit'),
              mainThreadAssets,
              debugInfo,
            };
          },
        );
      });
    },
  ],
};
