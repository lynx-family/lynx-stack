import { defineConfig } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

import base from './rsbuild.config.js';

export default defineConfig({
  ...base,
  plugins: [pluginReactLynx({
    experimental_useElementTemplate: false,
    experimental_reEvalJSOnReload: false,
    globalPropsMode: 'reactive',
  })],
  output: { distPath: { root: 'dist-snapshot-probes' } },
});
