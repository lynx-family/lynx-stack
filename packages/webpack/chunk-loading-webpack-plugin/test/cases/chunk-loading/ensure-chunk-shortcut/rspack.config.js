import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { ChunkLoadingWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'development',
  output: {
    chunkLoading: 'lynx',
    chunkFormat: 'commonjs',
    chunkFilename: '[id].rspack.bundle.cjs',
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    compiler => {
      const { RuntimeModule } = compiler.rspack;

      compiler.hooks.compilation.tap('test', compilation => {
        compilation.hooks.runtimeRequirementInTree.for(
          RuntimeGlobals.lynxAsyncChunkIds,
        ).tap('test', (chunk) => {
          compilation.addRuntimeModule(
            chunk,
            new LynxAsyncChunksRuntimeModule(),
          );
        });
      });

      class LynxAsyncChunksRuntimeModule extends RuntimeModule {
        constructor() {
          super('Lynx async chunks', RuntimeModule.STAGE_ATTACH);
        }

        /**
         * @override
         */
        generate() {
          const chunk =
            /** @type {import('@rspack/core').Chunk} */ (this.chunk);

          return `// lynx async chunks
    ${RuntimeGlobals.lynxAsyncChunkIds} = ${
            JSON.stringify(
              Object.fromEntries(
                Array.from(chunk.getAllAsyncChunks()).map(
                  /** @param {import('@rspack/core').Chunk} c */
                  c => [c.id, c.name],
                ),
              ),
            )
          }`;
        }
      }
    },
  ],
};
