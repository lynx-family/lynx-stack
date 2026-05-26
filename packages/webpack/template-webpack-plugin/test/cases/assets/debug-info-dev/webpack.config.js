import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

const debugMetadataUrl =
  'http://10.0.0.2:3000/.rspeedy/main/debug-metadata.json';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  target: 'node',
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      intermediate: '.rspeedy/main',
    }),
    {
      apply(compiler) {
        compiler.hooks.compilation.tap(
          'DevDebugMetadataPlugin',
          (compilation) => {
            LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation)
              .beforeEncode.tap(
                'DevDebugMetadataPlugin',
                (data) => {
                  data.encodeData.sourceContent.config.debugMetadataUrl =
                    debugMetadataUrl;
                  data.encodeData.compilerOptions.templateDebugUrl =
                    `${debugMetadataUrl}?field=bytecode-debug-info&filename=main-thread.js`;
                  return data;
                },
              );
          },
        );
      },
    },
  ],
};
