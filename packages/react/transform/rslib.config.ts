import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      dts: false,
      source: {
        entry: {
          'index': './main.js',
        },
      },
      output: {
        copy: {
          patterns: [
            {
              from: './index.d.ts',
              to: './index.d.ts',
            },
            {
              from: './swc-plugin-reactlynx/index.d.ts',
              to: './swc-plugin-reactlynx/index.d.ts',
            },
            {
              from: './swc-plugin-reactlynx-compat/index.d.ts',
              to: './swc-plugin-reactlynx-compat/index.d.ts',
            }
          ],
        },
      },
    },
  ],
});
