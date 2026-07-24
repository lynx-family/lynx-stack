import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';
import path from 'node:path';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.tsx',
    },
    include: [/node_modules[\\/]@lynx-js[\\/]/, /@lynx-js[\\/]/],
  },
  output: {
    target: 'web',
    assetPrefix: process.env.ASSET_PREFIX,
    distPath: {
      root: 'dist',
    },
    overrideBrowserslist: ['Chrome > 118'],
  },
  html: {
    title: 'Lynx REPL',
    template: './index.html',
  },
  tools: {
    rspack: {
      ignoreWarnings: [
        (warning) =>
          warning.module?.resource?.includes('monaco-editor')
          && warning.message.includes('Critical dependency')
          && warning.message.includes('require function is used in a way'),
        (warning) =>
          warning.module?.resource?.includes('monaco-editor')
          && warning.message.includes(
            '"__filename" is used and has been mocked',
          ),
        (warning) =>
          warning.module?.resource?.includes('monaco-editor')
          && warning.message.includes(
            '"__dirname" is used and has been mocked',
          ),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
          '@lynx-js/web-core/client$': path.resolve(
            __dirname,
            '../web-platform/web-core/ts/client/index.ts',
          ),
          '@lynx-js/web-elements/all$': path.resolve(
            __dirname,
            '../web-platform/web-elements/src/elements/all.ts',
          ),
          '@lynx-js/web-elements$': path.resolve(
            __dirname,
            '../web-platform/web-elements/src/elements/index.ts',
          ),
          '@lynx-js/type-element-api/types/element-api.d.ts': path.resolve(
            __dirname,
            'node_modules/@lynx-js/type-element-api/types/element-api.d.ts',
          ),
          '@lynx-js/web-worker-rpc$': path.resolve(
            __dirname,
            '../web-platform/web-worker-rpc/src/index.ts',
          ),
        },
        fallback: {
          module: false,
        },
        modules: [
          'node_modules',
          path.resolve(__dirname, 'node_modules'),
          path.resolve(__dirname, '../../node_modules'),
        ],
        symlinks: true,
      },
    },
  },
  splitChunks: false,
  plugins: [
    pluginReact(),
    pluginWebPlatform({
      polyfill: false,
    }),
  ],
});
