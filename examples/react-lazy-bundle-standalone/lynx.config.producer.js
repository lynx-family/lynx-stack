import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { detectLanHost, producerDevPort } from './demo-ports.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];
const enableFetchBundle = !!process.env['LAZY_BUNDLE_FETCHBUNDLE'];
const producerPublicPath = `http://${detectLanHost()}:${producerDevPort}/`;

export default defineConfig({
  source: {
    entry: {
      LazyComponent: './src/LazyComponent.tsx',
      LazyComponentSync: './src/LazyComponentSync.tsx',
      LazyComponentAsync: './src/LazyComponentAsync.tsx',
      add: './src/utils/add.ts',
      minus: './src/utils/minus.ts',
      dynamic: './src/utils/dynamic.ts',
    },
  },
  output: {
    assetPrefix: producerPublicPath,
    distPath: {
      // Separate output per loader variant so `pnpm build` (querycomponent +
      // fetchbundle) doesn't clobber the first pass.
      root: path.join(
        projectRoot,
        enableFetchBundle ? 'dist-producer-fetchbundle' : 'dist-producer',
      ),
    },
  },
  dev: {
    assetPrefix: producerPublicPath,
  },
  server: {
    port: producerDevPort,
    strictPort: true,
  },
  plugins: [
    pluginReactLynx({
      experimental_isLazyBundle: true,
      ...(enableFetchBundle ? { engineVersion: '3.8' } : {}),
    }),
  ],
  environments: {
    lynx: {},
  },
  performance: {
    profile: enableBundleAnalysis,
  },
});
