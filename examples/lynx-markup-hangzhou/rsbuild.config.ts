import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  html: {
    title: '杭州 5 天旅行卡 · Lynx XML',
  },
  server: {
    publicDir: [
      {
        name: 'public',
        copyOnBuild: true,
      },
    ],
  },
});
