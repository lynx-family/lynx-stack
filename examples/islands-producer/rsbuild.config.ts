import { defineConfig } from '@rsbuild/core';

import { pluginIslands } from '@lynx-js/islands/build';

export default defineConfig({
  environments: { lynx: {} },
  plugins: [
    pluginIslands({
      exposes: { greeting: './xml/greeting.lynxml' },
      output: { mode: 'remote', filename: 'greeting.lynx.bundle' },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
  },
});
