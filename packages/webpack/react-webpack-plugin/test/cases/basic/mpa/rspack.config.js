import { createConfig, createEntries } from '../../../create-react-config.js';

const defaultConfig = createConfig(undefined, { mainThreadChunks: [] });

/** @type {import('webpack').Configuration} */
export default {
  ...defaultConfig,
  entry: {
    ...createEntries('a', './a.js'),
    ...createEntries('b', './b.js'),
    ...createEntries('c', './c.js'),
    ...createEntries('d', './d.js'),
    ...createEntries('e', './e.js'),
  },
  context: import.meta.dirname,
};
