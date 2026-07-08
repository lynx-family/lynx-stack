import { defineConfig } from '@rsbuild/core';

// Browser host that serves the built `.web.bundle`s (in `dist/`) and mounts
// `<lynx-view>`.
export default defineConfig({
  source: {
    entry: {
      index: './web/index.ts',
    },
  },
  server: {
    publicDir: [
      {
        name: 'dist',
        copyOnBuild: false,
      },
    ],
  },
});
