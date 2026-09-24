import { defineConfig } from '@rsbuild/core';

import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';
import { configKeys as defaultConfigKeys } from '@lynx-js/type-config';

const useRC = process.env['RC'] === '1';
const useElementTemplate = process.env['ET'] === '1';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginLynx(),
    pluginReactLynx({ experimental_useElementTemplate: useElementTemplate }),
    pluginLynxConfig(
      // `disableQuickTracingGC` is not exported by `@lynx-js/type-config` yet.
      /** @type {import('@lynx-js/config-rsbuild-plugin').Config} */ ({
        disableQuickTracingGC: useRC,
      }),
      {
        configKeys: [...defaultConfigKeys, 'disableQuickTracingGC'],
        validate: (
          input,
        ) => /** @type {import('@lynx-js/config-rsbuild-plugin').Config} */ (input),
      },
    ),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  environments: {
    lynx: {},
  },
});
