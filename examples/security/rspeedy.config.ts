import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './public/index.html',
  },
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
