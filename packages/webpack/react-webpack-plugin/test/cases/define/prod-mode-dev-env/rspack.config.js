import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

let oldNodeEnv;
config.plugins.unshift({
  apply: () => {
    oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
  },
});

config.plugins.push({
  apply: () => {
    process.env.NODE_ENV = oldNodeEnv;
  },
});

/** @type {import('@rspack/core').Configuration} */
export default {
  ...config,
  context: __dirname,
  mode: 'production',
};
