import os from 'node:os';

import { defineConfig } from '@rsbuild/core';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const useElementTemplate = process.env['RELOAD_LAB_ET'] === 'true';
const reEvalJSOnReload = process.env['RELOAD_LAB_REEVAL'] !== 'false';
const port = Number(process.env['RELOAD_LAB_PORT'] ?? '54175');
const host = process.env['RELOAD_LAB_HOST']
  ?? Object.values(os.networkInterfaces())
    .flatMap(interfaces => interfaces ?? [])
    .find(network => network.family === 'IPv4' && !network.internal)?.address
  ?? '127.0.0.1';
const assetPrefix = `http://${host}:${port}/`;

export default defineConfig({
  server: { port, strictPort: true },
  dev: { assetPrefix },
  output: { assetPrefix },
  source: {
    define: {
      __RELOAD_LAB_ET__: JSON.stringify(useElementTemplate),
    },
    entry: {
      main: './src/index.tsx',
      'main-thread-object-reload': './src/main-thread-object-reload.tsx',
      'stale-main-thread-return': './src/stale-main-thread-return.tsx',
      'stale-background-callback': './src/stale-background-callback.tsx',
    },
  },
  plugins: [
    pluginReactLynx({
      experimental_useElementTemplate: useElementTemplate,
      experimental_reEvalJSOnReload: reEvalJSOnReload,
      globalPropsMode: 'reactive',
    }),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  environments: {
    lynx: {},
  },
});
