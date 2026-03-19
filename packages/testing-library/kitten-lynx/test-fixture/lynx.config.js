import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: {
      main: './cases/react-example/index.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
  environments: {
    lynx: {},
  },
});
