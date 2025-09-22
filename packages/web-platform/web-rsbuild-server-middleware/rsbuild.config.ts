import { defineConfig } from '@rsbuild/core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  source: {
    entry: {
      index: path.join(__dirname, 'src', 'web', 'index.ts'),
    },
  },
  output: {
    target: 'web',
    distPath: {
      root: path.join(__dirname, 'www'),
    },
    filenameHash: false,
    polyfill: 'off',
    overrideBrowserslist: ['last 2 Chrome versions'],
    assetPrefix: 'http://lynx-web-core-mocked.localhost/',
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  tools: {
    rspack: {
      experiments: {
        asyncWebAssembly: true,
      },
    },
  },
});
