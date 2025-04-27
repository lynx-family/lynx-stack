import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...config,
  output: {
    ...config.output,
    chunkFilename: '.rspeedy/async/[name].js',
  },
  plugins: [
    ...config.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main:main-thread', 'main:background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
    }),
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );
        hooks.beforeEncode.tap(
          'test',
          (args) => {
            expect(args.encodeData.lepusCode.root.name).toBeOneOf(
              [ // main entry
                'main:main-thread.js',
                // foo.js lazy bundle
                '.rspeedy/async/./foo.js-react:main-thread.js',
              ],
            );
            expect(
              Object.keys(args.encodeData.manifest).length,
            ).toBe(1);
            expect(Object.keys(args.encodeData.manifest)[0]).toBeOneOf(
              [ // main entry
                'main:background.js',
                // foo.js lazy bundle
                '.rspeedy/async/./foo.js-react:background.js',
              ],
            );
          },
        );
      });
    },
  ],
};
