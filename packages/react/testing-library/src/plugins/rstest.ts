import type { RsbuildPlugin } from '@rsbuild/core';

export function testingLibraryPlugin(): RsbuildPlugin {
  return {
    name: 'lynx:testing-library:plugin',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        config = mergeRsbuildConfig(config, {
          dev: {
            // Ensure `this.hot` is `true` to generate `MIXED` bundle
            hmr: true,
          },
          tools: {
            rspack: {
              plugins: [
                (compiler: any) => {
                  new compiler.webpack.HotModuleReplacementPlugin().apply(compiler);
                },
              ],
            },
          },
          output: {
            externals: [
              // it is used for the implementation of `CoreContext` and `JSContext`
              'node:events',
            ],
          },
        });
        return config;
      });
      // stub the `rspeedy.api`
      api.expose(Symbol.for('rspeedy.api'), {
        debug: (message: string | (() => string)) => {
          if (typeof message === 'function') {
            message = message();
          }
          console.info(message);
        },
        logger: api.logger,
        config: api.getRsbuildConfig('current'),
        exit: () => {
          // do nothing
        },
        version: '0.0.0',
      });
    },
  };
}
