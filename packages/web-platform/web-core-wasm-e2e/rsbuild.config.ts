import { defineConfig } from '@rsbuild/core';
import { fileURLToPath } from 'node:url';
import { ssrMiddleware } from './shell-project/devMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
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
    distPath: {
      root: 'www',
    },
  },
  dev: {
    hmr: false,
    liveReload: false,
    writeToDisk: true,
    setupMiddlewares: [
      (middlewares: any) => {
        middlewares.unshift(ssrMiddleware);
        return middlewares;
      },
    ],
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
    htmlFallback: false,
  },
  html: {
    tags: [
      {
        tag: 'script',
        append: false,
        attrs: {
          module: 'true',
          src:
            '/node_modules/@lynx-js/web-core-wasm/dist/client_prod/static/js/client.js',
        },
      },
      {
        tag: 'link',
        append: false,
        attrs: {
          rel: 'stylesheet',
          href:
            '/node_modules/@lynx-js/web-core-wasm/dist/client_prod/static/css/client.css',
        },
      },
    ],
  },
});
