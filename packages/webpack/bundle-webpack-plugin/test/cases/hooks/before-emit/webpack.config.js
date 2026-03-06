import { LynxTemplatePlugin, LynxEncodePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
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
