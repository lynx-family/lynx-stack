import { defineConfig } from '@rsbuild/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT ?? 3080;
export default defineConfig({
  source: {
    entry: {
      index: './shell-project/index.ts',
    },
  },
  output: {
    assetPrefix: 'auto',
    polyfill: 'off',
  },
  server: {
    port: Number(port),
    publicDir: [
      {
        name: '.',
        copyOnBuild: false,
        watch: false,
      },
    ],
  },
  tools: {
    rspack: {
      experiments: {
        futureDefaults: true,
      },
    },
  },
});
