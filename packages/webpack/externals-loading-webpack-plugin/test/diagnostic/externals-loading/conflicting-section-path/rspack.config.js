import { createConfig } from '../../../helpers/create-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...createConfig(
    {
      backgroundLayer: 'background',
      mainThreadLayer: 'main-thread',
      externals: {
        'lib-a': {
          libraryName: ['MyLib', 'a'],
          url: 'http://example.com/lib.bundle',
          mainThread: {
            sectionPath: 'path/to/a',
          },
        },
        'lib-b': {
          libraryName: ['MyLib', 'b'],
          url: 'http://example.com/lib.bundle',
          mainThread: {
            sectionPath: 'path/to/b', // Conflict with 'path/to/a'
          },
        },
      },
    },
  ),
};
