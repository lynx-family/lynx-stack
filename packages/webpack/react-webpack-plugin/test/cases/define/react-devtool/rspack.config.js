import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

let oldReactDevtool;
config.plugins.unshift({
  apply: () => {
    oldReactDevtool = process.env.REACT_DEVTOOL;
    process.env.REACT_DEVTOOL = 'true';
  },
});

config.plugins.push({
  apply: () => {
    process.env.REACT_DEVTOOL = oldReactDevtool;
  },
});

/** @type {import('@rspack/core').Configuration} */
export default {
  ...config,
  context: import.meta.dirname,
  mode: 'production',
};
