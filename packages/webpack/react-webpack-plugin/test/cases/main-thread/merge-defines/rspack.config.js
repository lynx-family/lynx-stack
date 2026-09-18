import { createConfig } from '../../../create-react-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...createConfig(undefined, {
    entryPairs: [{
      mainThread: 'main__main-thread',
      background: 'main__background',
    }],
  }),
};
