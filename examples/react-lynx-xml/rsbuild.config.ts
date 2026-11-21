import os from 'node:os';

import { defineConfig } from '@rsbuild/core';

import { pluginIslands } from '@lynx-js/islands/build';
import { parseLynxXML } from '@lynx-js/lynx-xml/parser';
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
const xmlDelivery = process.env['XML_ISLAND_DELIVERY'] ?? 'inline';
if (xmlDelivery !== 'inline' && xmlDelivery !== 'remote') {
  throw new Error('XML_ISLAND_DELIVERY must be inline or remote');
}
const expose = 'xml-card';
const xmlFilename = 'xml-card.lynx.bundle';
const xmlModule = xmlDelivery === 'remote'
  ? { expose, entry: `${assetPrefix}${xmlFilename}` }
  : { expose };

export default defineConfig({
  source: {
    entry: { main: './src/index.tsx' },
  },
  environments: {
    lynx: {
      source: {
        define: {
          __XML_MODULE__: JSON.stringify(xmlModule),
        },
      },
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginIslands({
      exposes: {
        [expose]: { source: 'xml/card.lynxml', parse: parseLynxXML },
      },
      output: xmlDelivery === 'remote'
        ? { mode: 'remote', filename: xmlFilename }
        : { mode: 'inline' },
    }),
    pluginQRCode({ schema: url => `${url}?fullscreen=true` }),
  ],
  output: { assetPrefix, distPath: { root: `dist/${xmlDelivery}` } },
  dev: { assetPrefix },
  server: { host: '0.0.0.0', port, strictPort: true },
});
