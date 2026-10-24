import {
  LAYERS,
  defineExternalBundleRslibConfig,
} from '@lynx-js/lynx-bundle-rslib-config';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

const isAsync = process.env['REACTLYNX_ASYNC'] === 'true';

export default defineExternalBundleRslibConfig({
  id: 'utils',
  source: {
    entry: {
      './utils.js': {
        import: './src/utils.ts',
        layer: LAYERS.BACKGROUND,
      },
    },
  },
  plugins: [pluginLynx()],
  output: {
    cleanDistPath: false,
    globalObject: 'globalThis',
    ...(isAsync && {
      distPath: { root: 'dist-external-bundle-react-async' },
    }),
  },
});
