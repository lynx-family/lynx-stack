import { expect } from 'vitest';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

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
        const { RawSource } = compiler.webpack.sources;

        hooks.beforeEncode.tap(
          'test',
          (args) => {
            expect(args.encodeData).toHaveProperty(
              'lepusCode',
              expect.any(Object),
            );
            return {
              ...args,
              encodeData: {
                ...args.encodeData,
                lepusCode: {
                  ...args.encodeData.lepusCode,
                  root: {
                    name: '.rspeedy/main/main-thread.js',
                    info: {
                      minimized: true,
                      fullhash: [],
                      chunkhash: [],
                      contenthash: [],
                      javascriptModule: false,
                      related: {
                        sourceMap: '.rspeedy/main/main-thread.js.map',
                      },
                      'lynx:main-thread': true,
                    },
                    source: new RawSource('0'),
                  },
                  chunks: [{
                    name: 'Hello BeforeEncode',
                    source: new RawSource('0'),
                    info: {
                      'lynx:main-thread': true,
                    },
                  }],
                },
              },
            };
          },
        );

        hooks.beforeEmit.tap(
          'test',
          ({ debugInfo, mainThreadAssets, template }) => {
            expect(mainThreadAssets.length).toBe(2);

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
