import { createConfig } from '../../../helpers/create-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: new URL('.', import.meta.url).pathname,
  ...createConfig(
    {
      backgroundLayer: 'background',
      mainThreadLayer: 'main-thread',
      externals: {
        // Subpath libraryName: the mounted value is a promise resolving to
        // the WHOLE `FooLib` namespace, and `add` must be picked from the
        // resolved value, not from the pending promise.
        'foo': {
          libraryName: ['FooLib', 'add'],
          url: 'foo',
          async: true,
          background: {
            sectionPath: 'background',
          },
          mainThread: {
            sectionPath: 'mainThread',
          },
        },
        // Deeper subpath: every segment after the mount key (`Sub1` AND
        // `mul`) must be picked after the namespace promise resolves.
        'baz/sub1/mul': {
          libraryName: ['Baz', 'Sub1', 'mul'],
          url: 'baz',
          async: true,
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
