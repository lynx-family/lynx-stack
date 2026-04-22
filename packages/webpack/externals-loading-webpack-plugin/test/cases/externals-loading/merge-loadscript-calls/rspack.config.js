import { createConfig } from '../../../helpers/create-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: new URL('.', import.meta.url).pathname,
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
        // Two async externals sharing the same (url, sectionPath). They should merge
        // via createLoadExternalAsync.
        'pkg-d': {
          libraryName: 'PkgD',
          url: 'https://example.com/async.bundle',
          async: true,
          background: {
            sectionPath: 'shared',
          },
          mainThread: {
            sectionPath: 'shared__main-thread',
          },
        },
        'pkg-e': {
          libraryName: 'PkgE',
          url: 'https://example.com/async.bundle',
          async: true,
          background: {
            sectionPath: 'shared',
          },
          mainThread: {
            sectionPath: 'shared__main-thread',
          },
        },
        // A sync external sharing the SAME (url, sectionPath) as the async ones above.
        // Must NOT be merged with the async group because the runtime shape differs
        // (plain value vs Promise).
        'pkg-f': {
          libraryName: 'PkgF',
          url: 'https://example.com/async.bundle',
          async: false,
          background: {
            sectionPath: 'shared',
          },
          mainThread: {
            sectionPath: 'shared__main-thread',
          },
        },
      },
    },
  ),
};
