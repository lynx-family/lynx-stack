import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3001,
  },
  source: {
    entry: {
      'react-example': './test-fixture/cases/react-example/index.tsx',
    },
  },
  output: {
    assetPrefix: 'http://127.0.0.1:3001/',
  },
  plugins: [
    pluginReactLynx(),
  ],
  environments: {
    lynx: {},
    web: {},
  },
});
