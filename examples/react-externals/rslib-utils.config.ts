import {
  LAYERS,
  defineExternalBundleRslibConfig,
} from '@lynx-js/lynx-bundle-rslib-config';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

const isAsync = process.env['REACTLYNX_ASYNC'] === 'true';

const bundles: ReturnType<typeof defineExternalBundleRslibConfig> = {
  lib: ['utils', 'message'].map(name => {
    const config = defineExternalBundleRslibConfig({
      id: name,
      source: {
        entry: {
          [`./${name}.js`]: {
            import: `./src/${name}.ts`,
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
    const lib = config.lib![0]!;
    return {
      ...lib,
      id: name,
      plugins: [...(lib.plugins ?? []), ...(config.plugins ?? [])],
    };
  }),
};

export default bundles;
