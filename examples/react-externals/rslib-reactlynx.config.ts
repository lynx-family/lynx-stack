import { createRequire } from 'node:module';
import path from 'node:path';

import {
  LAYERS,
  defineExternalBundleRslibConfig,
} from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactAlias } from '@lynx-js/react-alias-rsbuild-plugin';
import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin';

const require = createRequire(import.meta.url);
const reactLynxDir = path.dirname(
  require.resolve('@lynx-js/react/package.json'),
);
export default defineExternalBundleRslibConfig({
  id: 'react',
  tools: {
    rspack: {
      module: {
        rules: [
          {
            test: /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/,
            issuerLayer: LAYERS.BACKGROUND,
            loader: ReactWebpackPlugin.loaders.BACKGROUND,
          },
          {
            issuerLayer: LAYERS.MAIN_THREAD,
            test: /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/,
            loader: ReactWebpackPlugin.loaders.MAIN_THREAD,
          },
        ],
      },
    },
  },
  source: {
    entry: {
      'ReactLynx': './external-bundle/ReactLynx.ts',
    },
    define: {
      '__DEV__': 'false',
      'process.env.NODE_ENV': '"production"',
      '__FIRST_SCREEN_SYNC_TIMING__': '"immediately"',
      '__ENABLE_SSR__': 'false',
      '__PROFILE__': 'false',
      '__EXTRACT_STR__': 'false',
    },
  },
  plugins: [
    pluginReactAlias({
      LAYERS,
      rootPath: reactLynxDir,
    }),
  ],
  output: {
    cleanDistPath: false,
    minify: false,
  },
});
