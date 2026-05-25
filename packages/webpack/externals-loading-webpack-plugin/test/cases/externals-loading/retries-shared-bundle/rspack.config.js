import { createConfig } from '../../../helpers/create-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: new URL('.', import.meta.url).pathname,
  ...createConfig(
    {
      backgroundLayer: 'background',
      mainThreadLayer: 'main-thread',
      externals: {
        'foo': {
          libraryName: 'Foo',
          url: 'shared.bundle',
          async: true,
          retries: 1,
          background: { sectionPath: 'Foo__background' },
          mainThread: { sectionPath: 'Foo__mainThread' },
        },
        'bar': {
          libraryName: 'Bar',
          url: 'shared.bundle',
          async: true,
          retries: 7,
          background: { sectionPath: 'Bar__background' },
          mainThread: { sectionPath: 'Bar__mainThread' },
        },
        'baz': {
          libraryName: 'Baz',
          url: 'shared.bundle',
          async: true,
          retries: 4,
          background: { sectionPath: 'Baz__background' },
          mainThread: { sectionPath: 'Baz__mainThread' },
        },
      },
    },
  ),
};
