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
    // Restore precisely: an unset var must be deleted, not assigned
    // `undefined` (which would coerce to the truthy string "undefined").
    if (oldReactDevtool === undefined) {
      delete process.env.REACT_DEVTOOL;
    } else {
      process.env.REACT_DEVTOOL = oldReactDevtool;
    }
  },
});

/** @type {import('@rspack/core').Configuration} */
export default {
  ...config,
  context: import.meta.dirname,
  mode: 'production',
};
