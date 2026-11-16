import os from 'node:os';

import { defineConfig } from '@rsbuild/core';

import { pluginParcels } from '@lynx-js/parcels/compiler';
import { compileLynxXml } from '@lynx-js/parcels/compiler/lynx-xml';
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
const xmlMode = process.env['XML_BUNDLE_MODE'] ?? 'embedded';
if (xmlMode !== 'embedded' && xmlMode !== 'external') {
  throw new Error('XML_BUNDLE_MODE must be embedded or external');
}
const sectionPrefix = 'xml-card';
const xmlFilename = 'xml-card.lynx.bundle';
const xmlSource = xmlMode === 'external'
  ? { kind: xmlMode, sectionPrefix, url: `${assetPrefix}${xmlFilename}` }
  : { kind: xmlMode, sectionPrefix };

export default defineConfig({
  source: {
    entry: { main: './src/index.tsx' },
  },
  environments: {
    lynx: {
      source: {
        define: {
          __XML_SOURCE__: JSON.stringify(xmlSource),
        },
      },
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginParcels({
      sourcePath: 'xml/card.lynxml',
      compile: compileLynxXml,
      sectionPrefix,
      delivery: xmlMode === 'external'
        ? { kind: 'external', filename: xmlFilename }
        : { kind: 'embedded' },
    }),
    pluginQRCode({ schema: url => `${url}?fullscreen=true` }),
  ],
  output: { assetPrefix, distPath: { root: `dist/${xmlMode}` } },
  dev: { assetPrefix },
  server: { host: '0.0.0.0', port, strictPort: true },
});
