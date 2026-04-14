import { createConfig } from '../../../helpers/create-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...createConfig(
    {
      backgroundLayer: 'background',
      mainThreadLayer: 'main-thread',
      externals: {
        // Two different library names pointing to the same (url, sectionPath).
        // Only one loadScript call should be generated per section.
        'pkg-a': {
          libraryName: 'PkgA',
          url: 'https://example.com/common.bundle',
          async: false,
          background: {
            sectionPath: 'common',
          },
          mainThread: {
            sectionPath: 'common__main-thread',
          },
        },
        'pkg-b': {
          libraryName: 'PkgB',
          url: 'https://example.com/common.bundle',
          async: false,
          background: {
            sectionPath: 'common',
          },
          mainThread: {
            sectionPath: 'common__main-thread',
          },
        },
        // A third external with the same section but different bundle — should still
        // generate its own loadScript call.
        'pkg-c': {
          libraryName: 'PkgC',
          url: 'https://example.com/other.bundle',
          async: false,
          background: {
            sectionPath: 'common',
          },
          mainThread: {
            sectionPath: 'common__main-thread',
          },
        },
      },
    },
  ),
};
