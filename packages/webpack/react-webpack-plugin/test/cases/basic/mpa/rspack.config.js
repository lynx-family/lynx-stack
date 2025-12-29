import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfig, createEntries } from '../../../create-react-config.js';

const defaultConfig = createConfig(undefined, { mainThreadChunks: [] });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  context: __dirname,
};
