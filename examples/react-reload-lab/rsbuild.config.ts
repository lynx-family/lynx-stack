import { defineConfig } from '@rsbuild/core';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const useElementTemplate = process.env['RELOAD_LAB_ET'] === 'true';

export default defineConfig({
  source: {
    define: {
      __RELOAD_LAB_ET__: JSON.stringify(useElementTemplate),
    },
    entry: {
      main: './src/index.tsx',
      'main-thread-object-reload': './src/main-thread-object-reload.tsx',
      'stale-main-thread-return': './src/stale-main-thread-return.tsx',
      'stale-background-callback': './src/stale-background-callback.tsx',
    },
  },
  plugins: [
    pluginReactLynx({
      experimental_useElementTemplate: useElementTemplate,
      experimental_reEvalJSOnReload: true,
      globalPropsMode: 'reactive',
    }),
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
