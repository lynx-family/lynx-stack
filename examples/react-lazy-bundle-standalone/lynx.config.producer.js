import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { producerDevPort } from './demo-ports.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

export default defineConfig({
  source: {
    entry: {
      LazyComponent: './src/LazyComponent.tsx',
      add: './src/utils/add.ts',
      minus: './src/utils/minus.ts',
      dynamic: './src/utils/dynamic.ts',
    },
  },
  output: {
    distPath: {
      root: path.join(projectRoot, 'dist-producer'),
    },
  },
  server: {
    port: producerDevPort,
    strictPort: true,
  },
  plugins: [
    pluginReactLynx({
      experimental_isLazyBundle: true,
    }),
  ],
  environments: {
    lynx: {
      performance: {
        profile: enableBundleAnalysis,
      },
    },
  },
});
