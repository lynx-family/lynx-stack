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
