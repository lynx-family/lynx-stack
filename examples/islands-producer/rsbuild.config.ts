import { defineConfig } from '@rsbuild/core';

import { pluginIslands } from '@lynx-js/islands/build';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

export default defineConfig({
  environments: { lynx: {} },
  plugins: [
    pluginLynx(),
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
