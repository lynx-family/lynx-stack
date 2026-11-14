import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

// REACTLYNX_ASYNC=true builds comp-lib against async (Promise) ReactLynx
// externals to match an async host; output isolated in
// `dist-external-bundle-react-async` so the sync build is untouched.
const isAsync = process.env['REACTLYNX_ASYNC'] === 'true';

export default defineExternalBundleRslibConfig({
  id: 'comp-lib',
  source: {
    entry: {
      './App.js': './external-bundle/CompLib.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
  // Sync and async share this config file, so rspack's persistent cache (keyed
  // on the config) would otherwise reuse one variant's compiled modules for the
  // other — the `output.externals` callback isn't distinguished in the cache
  // hash. Split the cache per variant.
  performance: {
    buildCache: {
      cacheDigest: [isAsync ? 'react-async' : 'react-sync'],
    },
  },
  output: {
    externalsPresets: isAsync
      ? { reactlynx: { async: true } }
      : { reactlynx: true },
    ...(isAsync && {
      distPath: { root: 'dist-external-bundle-react-async' },
    }),
    globalObject: 'globalThis',
  },
});
