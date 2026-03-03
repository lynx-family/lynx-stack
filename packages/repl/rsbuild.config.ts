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
          '@lynx-js/type-element-api/types/element-api.d.ts': path.resolve(
            __dirname,
            'node_modules/@lynx-js/type-element-api/types/element-api.d.ts',
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
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  plugins: [
    pluginReact(),
    pluginWebPlatform({
      polyfill: false,
    }),
  ],
});
