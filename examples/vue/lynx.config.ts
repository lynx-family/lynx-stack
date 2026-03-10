import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginVueLynx } from '@lynx-js/vue-rsbuild-plugin';

export default defineConfig({
  environments: {
    lynx: {},
    web: {},
  },
  plugins: [
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginVueLynx({
      optionsApi: false,
    }),
  ],
});
