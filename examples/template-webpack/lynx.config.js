import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { pluginTemplateWebpack } from './plugin.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  dev: {
    hmr: false,
    liveReload: false,
  },
  output: {
    distPath: {
      root: path.join(projectRoot, 'dist'),
    },
    filename: 'card.bundle',
  },
  plugins: [
    pluginTemplateWebpack(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
});
