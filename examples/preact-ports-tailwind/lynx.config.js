import { pluginTailwindCSS } from 'rsbuild-plugin-tailwindcss';

import { pluginPreactLynx } from '@lynx-js/preact-runtime/plugin';
import { defineConfig } from '@lynx-js/rspeedy';

// Runs the original examples/tailwindcss sources on the transform-free
// preact runtime.
export default defineConfig({
  source: {
    entry: {
      main: '../tailwindcss/src/index.tsx',
    },
  },
  plugins: [
    pluginPreactLynx(),
    pluginTailwindCSS({
      config: '../tailwindcss/tailwind.config.ts',
      exclude: [/[\\/]node_modules[\\/]/],
    }),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});
