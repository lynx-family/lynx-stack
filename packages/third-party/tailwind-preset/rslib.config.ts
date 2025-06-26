import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      lynx: './src/lynx.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    distPath: {
      root: './dist',
    },
    externals: {
      tailwindcss: 'tailwindcss',
      'tailwindcss/**': 'tailwindcss',
    },
  },
  lib: [
    {
      dts: true,
      format: 'esm',
    },
    {
      format: 'cjs',
    },
  ],
});
