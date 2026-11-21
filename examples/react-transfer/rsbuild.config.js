import { defineConfig } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      'transfer-chat': './src/transfer-chat.tsx',
      'transfer-first-frame': './src/transfer-first-frame.tsx',
    },
  },
  plugins: [pluginReactLynx()],
  environments: {
    lynx: {},
  },
});
