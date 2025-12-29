import { defineConfig } from '@rsbuild/core';
import { pluginSourceBuild } from '@rsbuild/plugin-source-build';

const port = process.env.PORT ?? 3080;
export default defineConfig({
  source: {
    entry: {
      main: './tests/fixtures/shell-project.ts',
    },
  },
  output: {
    assetPrefix: 'auto',
    polyfill: 'off',
    distPath: {
      root: 'www',
      css: '.',
      js: '.',
    },
    filename: {
      css: '[name].css',
      html: 'index.html',
    },
    cleanDistPath: true,
    sourceMap: true,
  },
  plugins: [
    pluginSourceBuild(),
  ],
  dev: {
    hmr: false,
    liveReload: false,
    writeToDisk: true,
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
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
});
