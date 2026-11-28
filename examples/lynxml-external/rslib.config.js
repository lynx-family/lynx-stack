import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

export default defineExternalBundleRslibConfig({
  id: 'math',
  source: { entry: { math: './math.lynxml' } },
  plugins: [pluginLynx()],
  output: { distPath: { root: 'dist' }, cleanDistPath: false },
}, { engineVersion: '3.9' });
