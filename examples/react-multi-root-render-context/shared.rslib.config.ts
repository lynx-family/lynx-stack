import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

// The shared surface of the app. Pages resolve './Shared.js' to this bundle
// at runtime, so every page in the shared JS context gets the same module
// instances.
export default defineExternalBundleRslibConfig({
  id: 'shared',
  source: {
    entry: {
      './Shared.js': './src/Shared.ts',
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
  output: {
    cleanDistPath: false,
    distPath: {
      root: 'dist-external-bundle',
    },
  },
}, {
  target: 'tasm',
});
