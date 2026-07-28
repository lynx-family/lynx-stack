import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

// A shared ReactLynx bundle with multi-root render context support. The
// published `@lynx-js/react-umd` artifacts are built without the flag, so
// this example builds its own.
export default defineExternalBundleRslibConfig({
  id: 'react',
  source: {
    entry: {
      'ReactLynx': './src/react-entry.ts',
    },
  },
  plugins: [
    pluginReactLynx({ experimental_multiRootRenderContext: true }),
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
