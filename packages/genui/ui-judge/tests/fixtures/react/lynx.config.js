import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
  output: {
    dataUriLimit: Number.POSITIVE_INFINITY,
    distPath: {
      root: '.generated',
    },
  },
});
