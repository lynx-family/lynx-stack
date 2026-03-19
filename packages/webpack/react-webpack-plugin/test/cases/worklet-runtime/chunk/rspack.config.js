import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfig } from '../../../create-react-config.js';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const defaultConfig = createConfig({}, {
  mainThreadChunks: ['main__main-thread.js'],
}, {});

// Add worklet-runtime to main-thread entry (simulating rspeedy entry setup)
defaultConfig.entry['main__main-thread'].import = [
  defaultConfig.entry['main__main-thread'].import,
  require.resolve('@lynx-js/react/worklet-dev-runtime'),
].flat();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...defaultConfig,
  plugins: [
    ...defaultConfig.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.json',
      intermediate: '.rspeedy',
    }),
  ],
};
