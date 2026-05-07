import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { producerDevPort } from './demo-ports.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

export default defineConfig({
  source: {
    entry: './src/index.tsx',
    define: {
      'process.env.LYNX_STANDALONE_PRODUCER_PORT': producerDevPort.toString(),
    },
  },
  output: {
    distPath: {
      root: path.join(projectRoot, 'dist-consumer'),
    },
  },
  server: {
    proxy: {
      '/producer': {
        target: `http://127.0.0.1:${producerDevPort}`,
        pathRewrite: {
          '^/producer': '',
        },
      },
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
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
