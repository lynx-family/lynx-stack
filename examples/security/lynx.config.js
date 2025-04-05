import { defineConfig } from '@lynx-js/rspeedy';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

// Create a custom plugin to handle security configuration
const pluginSecurity = () => ({
  name: 'plugin-security',
  setup() {
    // Security configuration will be handled in the app code
  },
});

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
    pluginSecurity(),
  ],
  // Security configuration is now removed from here and handled in the app code
});
