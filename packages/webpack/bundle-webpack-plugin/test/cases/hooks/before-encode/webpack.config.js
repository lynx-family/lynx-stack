import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  target: 'node',
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin(),
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
                  chunks: [{
                    name: 'Hello BeforeEncode',
                    source: new RawSource('0'),
                    info: {
                      ['lynx:main-thread']: true,
                    },
                  }],
                  filename: 'hello.lepus.js',
                },
              },
            };
          },
        );
      });
    },
  ],
};
