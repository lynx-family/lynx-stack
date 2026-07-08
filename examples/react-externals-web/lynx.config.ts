import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginExternalBundle({
      externalsPresets: {
        reactlynx: {
          async: true,
        },
      },
      externals: {
        './App.js': 'comp-lib.web.bundle',
      },
      globalObject: 'globalThis',
    }),
  ],
  environments: {
    web: {},
  },
});
