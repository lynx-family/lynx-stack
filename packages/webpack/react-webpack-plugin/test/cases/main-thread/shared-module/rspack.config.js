import { expect } from '@rstest/core';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig(
  { experimental_enableMTSRendering: false },
  {
    experimental_enableMTSRendering: false,
    mainThreadEntries: { 'main__main-thread': 'main__background' },
  },
);

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...defaultConfig,
  plugins: [
    ...defaultConfig.plugins,
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    compiler => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        compilation.hooks.processAssets.tap({
          name: 'test',
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
        }, () => {
          const mainThread = compilation
            .getAsset('main__main-thread.js')
            ?.source
            .source()
            .toString();
          expect(mainThread).toBeTypeOf('string');

          // The shared module compiles into the main-thread layer behind a
          // wrapper that registers its namespace under a build-stable id...
          expect(mainThread).toContain('shared-module-marker');
          const registered =
            /__REACT_LYNX_SHARED_MODULES__[\s\S]*?\.set\("([0-9a-f]{16})"/
              .exec(mainThread);
          expect(registered).not.toBeNull();

          // ...and the collected definition dereferences that same id rather
          // than a module binding it cannot have here.
          expect(mainThread).toContain(`getSharedModule("${registered[1]}")`);
          expect(mainThread).toContain(
            'var getSharedModule = ReactLynx.getSharedModule;',
          );
        });
      });
    },
  ],
};
