import { createConfig } from '../../../helpers/create-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...createConfig(
    {
      backgroundChunks: ['main:background'],
      mainThreadChunks: ['main:main-thread'],
      backgroundLayer: 'background',
      mainThreadLayer: 'main-thread',
      externals: {
        'mock-module': {
          libraryName: 'MockModule',
          url: 'mock-module',
          mainThread: {
            sectionPath: 'mainThread',
          },
        },
      },
    },
  ),
};
