import { createConfig } from '../../../helpers/create-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...createConfig(
    {
      backgroundLayer: 'background',
      mainThreadLayer: 'main-thread',
      externals: {
        'foo': {
          libraryName: 'Foo',
          url: 'foo',
          async: true,
          background: {
            sectionPath: 'background',
          },
          mainThread: {
            sectionPath: 'mainThread',
          },
        },
      },
    },
  ),
};
