import os from 'node:os';

import { defineConfig } from '@rsbuild/core';

import { pluginIslands } from '@lynx-js/islands/build';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

function detectLanHost(): string {
  if (process.env['LYNX_HOST']) return process.env['LYNX_HOST'];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return 'localhost';
}

const port = Number(process.env['PORT'] ?? 3000);
const assetPrefix = `http://${detectLanHost()}:${port}/`;
const renderer = process.env['XML_RENDERER'] ?? 'island';
const frameSync = process.env['XML_FRAME_SYNC'] ?? 'true';
if (frameSync !== 'true' && frameSync !== 'false') {
  throw new Error('XML_FRAME_SYNC must be true or false');
}
const frameSource = new URL('card.lynxml', assetPrefix);
if (frameSync === 'true') frameSource.searchParams.set('sync', 'true');
if (renderer !== 'island' && renderer !== 'frame') {
  throw new Error('XML_RENDERER must be island or frame');
}

export default defineConfig({
  source: {
    entry: { main: './src/index.tsx' },
  },
  environments: {
    lynx: {
      source: {
        define: {
          __XML_RENDERER__: JSON.stringify(renderer),
          __XML_FRAME_SRC__: JSON.stringify(frameSource.href),
          __XML_BENCHMARK__: JSON.stringify(
            process.env['XML_BENCHMARK'] === '1',
          ),
        },
      },
    },
  },
  plugins: [
    pluginReactLynx(),
    ...(renderer === 'island'
      ? [pluginIslands({
        exposes: {
          'xml-card': './xml/card.lynxml',
        },
      })]
      : []),
    pluginQRCode({ schema: url => `${url}?fullscreen=true` }),
  ],
  output: {
    assetPrefix,
    distPath: {
      root: renderer === 'frame'
        ? (frameSync === 'true' ? 'dist/frame-sync' : 'dist/frame')
        : 'dist/inline',
    },
    copy: [{ from: './xml/card.lynxml', to: 'card.lynxml' }],
  },
  dev: { assetPrefix },
  server: { host: '0.0.0.0', port, strictPort: true },
});
