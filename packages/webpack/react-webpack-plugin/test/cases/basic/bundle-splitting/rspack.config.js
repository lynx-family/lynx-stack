import { expect } from 'vitest';

import { createConfig } from '../../../create-react-config.js';
import { ReactWebpackPlugin } from '../../../../src';

const defaultConfig = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...defaultConfig,
  optimization: {
    ...defaultConfig.optimization,
    moduleIds: 'named',
    splitChunks: {
      chunks(chunk) {
        return !chunk.name?.includes('main-thread');
      },
      cacheGroups: {
        preact: {
          name: 'lib-preact',
          test:
            /node_modules[\\/](.*?[\\/])?(?:preact|preact[\\/]compat|preact[\\/]hooks|preact[\\/]jsx-runtime)[\\/]/,
          priority: 0,
        },
      },
    },
  },
  target: 'node',
  plugins: [
    new ReactWebpackPlugin({
      mainThreadChunks: ['main__main-thread.js'],
    }),
    /**
     * @param {import('@rspack/core').Compiler} compiler - The Rspack Compiler.
     */
    compiler => {
      compiler.hooks.thisCompilation.tap('check', (compilation) => {
        compiler.hooks.done.tap('check', () => {
          const lepus = compilation.getAsset('main__main-thread.js');
          expect(lepus).not.toBeUndefined();
          expect(lepus.info).toHaveProperty(
            'lynx:main-thread',
            true,
          );
        });
      });
    },
  ],
};
