import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: './src/index.tsx',
  },
  output: {
    distPath: {
      root: 'output',
    },
    filenameHash: 'contenthash:8',
  },
  plugins: [
    pluginReactLynx({
      enableRemoveCSSScope: true,
    }),
  ],
});
