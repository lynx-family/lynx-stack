import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import { configKeys as defaultConfigKeys } from '@lynx-js/type-config';

const useRC = process.env['RC'] === '1';
const useElementTemplate = process.env['ET'] === '1';

export default defineConfig({
  plugins: [
    pluginReactLynx({ experimental_useElementTemplate: useElementTemplate }),
    // `RC=1` puts the LepusNG main-thread context in its reference-counting
    // variant (`Lynx_LepusNG_RC`), the mode the leak was reported under.
    // `@lynx-js/type-config` does not export the key yet, so it is listed
    // explicitly to get past validation.
    pluginLynxConfig({ disableQuickTracingGC: useRC }, {
      configKeys: [...defaultConfigKeys, 'disableQuickTracingGC'],
      validate: (input) => input,
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
