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
          url: 'https://example.com/common.bundle',
          async: false,
          background: {
            sectionPath: 'background',
          },
          mainThread: {
            sectionPath: 'mainThread',
          },
        },
        'bar': {
          libraryName: 'Bar',
          url: 'https://example.com/common.bundle',
          async: false,
          background: {
            sectionPath: 'Bar__background',
          },
          mainThread: {
            sectionPath: 'Bar__mainThread',
          },
        },
        'baz/sub1': {
          libraryName: ['Baz', 'Sub1'],
          url: 'https://example.com/common.bundle',
          async: false,
          background: {
            sectionPath: 'Baz__background',
          },
          mainThread: {
            sectionPath: 'Baz__mainThread',
          },
        },
        'baz/sub2': {
          libraryName: ['Baz', 'Sub2'],
          url: 'https://example.com/common.bundle',
          async: false,
          background: {
            sectionPath: 'Baz__background',
          },
          mainThread: {
            sectionPath: 'Baz__mainThread',
          },
        },
      },
    },
  ),
};
