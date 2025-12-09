import { defineConfig } from '@rslib/core';
import './scripts/build.js';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      source: {
        entry: {
          index: './ts/encode/index.ts',
        },
        tsconfigPath: './tsconfig.build.json',
      },
      output: {
        target: 'node',
        distPath: {
          root: './dist/encode',
        },
        minify: true,
      },
      tools: {
        rspack: {
          target: 'node20',
        },
      },
    },
    {
      format: 'esm',
      source: {
        entry: {
          index: './ts/client/index.ts',
          background: './ts/client/background/index.ts',
        },
        tsconfigPath: './tsconfig.build.json',
      },
      output: {
        target: 'web',
        distPath: {
          root: './dist/client',
        },
        minify: true,
      },
      autoExternal: false,
      tools: {
        rspack: {
          target: [
            'web',
            'browserslist:Chrome > 92',
            'browserslist:Safari > 16.4',
          ],
          output: {
            publicPath: 'auto',
          },
          experiments: {
            asyncWebAssembly: true,
          },
        },
      },
    },
  ],
});
