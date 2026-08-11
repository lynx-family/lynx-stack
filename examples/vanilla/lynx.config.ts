import { defineConfig } from '@lynx-js/rspeedy';
import { pluginVanillaLynx } from '@lynx-js/vanilla-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: './src/main-thread.ts',
  },
  plugins: [pluginVanillaLynx()],
  environments: {
    web: {},
    lynx: {},
  },
});
