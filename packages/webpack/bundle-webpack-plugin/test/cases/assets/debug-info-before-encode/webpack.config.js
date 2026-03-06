import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  target: 'node',
  output: {
    publicPath: 'https://should-be-overridden.com/',
  },
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      intermediate: '.rspeedy/main',
    }),
    {
      apply(compiler) {
        compiler.hooks.compilation.tap('TestPlugin', (compilation) => {
          LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation)
            .beforeEncode.tap(
              'TestPlugin',
              (data) => {
                data.encodeData.compilerOptions.templateDebugUrl =
                  'https://custom-hook-url.com/debug-info.json';
                return data;
              },
            );
        });
      },
    },
  ],
};
