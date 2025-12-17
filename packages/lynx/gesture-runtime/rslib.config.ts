import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: true,
      bundle: false,
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  plugins: [pluginPublint()],
});
