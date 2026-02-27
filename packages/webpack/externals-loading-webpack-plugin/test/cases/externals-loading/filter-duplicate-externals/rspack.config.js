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
          async: false,
          background: {
            sectionPath: 'background',
          },
          mainThread: {
            sectionPath: 'mainThread',
          },
        },
        'foo': {
          libraryName: 'Foo',
          url: 'foo',
          async: false,
          background: {
            sectionPath: 'background',
          },
          mainThread: {
            sectionPath: 'mainThread',
          },
        },
        'foo2': {
          libraryName: 'Foo',
          url: 'foo',
          async: false,
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
