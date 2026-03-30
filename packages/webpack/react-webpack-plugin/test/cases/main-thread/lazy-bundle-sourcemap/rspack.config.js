import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const config = createConfig({
  enableNodeIndex: true,
}, {
  mainThreadChunks: [
    'main__main-thread.js',
    './lazy.jsx-react__main-thread.js',
  ],
  experimental_isLazyBundle: true,
});

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...config,
  devtool: 'source-map',
  optimization: {
    ...config.optimization,
    minimize: true,
  },
  plugins: [
    ...config.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
      experimental_isLazyBundle: true,
    }),
    {
      apply(compiler) {
        compiler.hooks.thisCompilation.tap(
          'CaptureNodeIndexMapPlugin',
          (compilation) => {
            compilation.hooks.processAssets.tap(
              {
                name: 'CaptureNodeIndexMapPlugin',
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
              },
              () => {
                compilation.getAssets()
                  .filter(asset => asset.name.endsWith('node-index-map.json'))
                  .forEach((asset) => {
                    compilation.emitAsset(
                      asset.name.replace(
                        'node-index-map.json',
                        'captured-node-index-map.json',
                      ),
                      asset.source,
                    );
                  });
              },
            );
          },
        );
      },
    },
  ],
};
