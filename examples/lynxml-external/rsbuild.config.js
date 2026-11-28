import { defineConfig } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const port = Number(process.env['PORT'] ?? 3487);
const mathBundleURL = new URL(
  process.env['LYNXML_MATH_BUNDLE_URL']
    ?? `http://localhost:${port}/math.lynx.bundle`,
);

export default defineConfig({
  source: {
    entry: { host: './src/index.jsx' },
    define: { __MATH_BUNDLE_URL__: JSON.stringify(mathBundleURL.href) },
  },
  plugins: [pluginReactLynx({ engineVersion: '3.9' })],
  environments: { lynx: {} },
  dev: { writeToDisk: false },
  server: {
    port,
    strictPort: true,
    publicDir: { name: 'dist', copyOnBuild: false },
  },
});
