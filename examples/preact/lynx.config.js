import { pluginPreactLynx } from '@lynx-js/preact-runtime/plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [
    pluginPreactLynx(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});
