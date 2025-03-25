import { createConfig } from '../../../create-react-config.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...createConfig(undefined, {
    extractStr: {
      strLength: 10,
    },
  }),
};
