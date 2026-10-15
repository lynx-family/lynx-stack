import { defineConfig } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

import base from './rsbuild.config.js';

export default defineConfig({
  ...base,
  source: {
    ...base.source,
    define: { ...base.source?.define, __RELOAD_LAB_ET__: 'true' },
  },
  plugins: [pluginReactLynx({
    experimental_useElementTemplate: true,
    experimental_reEvalJSOnReload: false,
    globalPropsMode: 'reactive',
  })],
  output: { distPath: { root: 'dist-et-probes' } },
});
