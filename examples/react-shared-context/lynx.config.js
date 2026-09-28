import fs from 'node:fs';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

function sharedChunkPath() {
  const dir = new URL('dist/static/js/', import.meta.url);
  const file = fs.existsSync(dir)
    && fs.readdirSync(dir).find(name => /^shared(?:\.\w+)?\.js$/.test(name));
  return `static/js/${file || 'shared.js'}`;
}

export default defineConfig({
  plugins: [
    pluginReactLynx({
      experimental_lynxGroupModuleSharing: true,
    }),
    pluginQRCode({
      schema(url) {
        const standaloneUrl = new URL(sharedChunkPath(), url).href;
        return `${url}?group=shared-context-demo&standalone_url=${
          encodeURIComponent(standaloneUrl)
        }`;
      },
    }),
  ],
  source: {
    entry: {
      pageA: './src/pageA.tsx',
      pageB: './src/pageB.tsx',
    },
  },
  splitChunks: {
    chunks: 'all',
    minSize: 0,
    minSizeReduction: 0,
    maxInitialRequests: 100000,
    maxAsyncRequests: 100000,
    cacheGroups: {
      default: false,
      defaultVendors: false,
      shared: {
        name: 'shared',
        minChunks: 2,
        enforce: true,
      },
    },
  },
  environments: {
    lynx: {},
  },
});
