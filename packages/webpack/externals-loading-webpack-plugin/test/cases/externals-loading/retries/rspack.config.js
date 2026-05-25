import { createConfig } from '../../../helpers/create-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: new URL('.', import.meta.url).pathname,
  ...createConfig(
    {
      backgroundLayer: 'background',
      mainThreadLayer: 'main-thread',
      retries: 5,
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
        'bar': {
          libraryName: 'Bar',
          url: 'bar',
          async: false,
          retries: 3,
          background: {
            sectionPath: 'Bar__background',
          },
          mainThread: {
            sectionPath: 'Bar__mainThread',
          },
        },
      },
    },
  ),
};
