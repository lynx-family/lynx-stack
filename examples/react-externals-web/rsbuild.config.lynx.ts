import { defineConfig } from '@rsbuild/core';

import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

import { pluginLynxBundleAnalysisStats } from '../bundle-analysis-stats.plugin.js';

export default defineConfig({
  source: {
    ...(process.env['COMP_LIB_MAIN_THREAD_DELAY_MS'] && {
      preEntry: ['../react-externals/src/main-thread-delay.ts'],
      define: {
        __COMP_LIB_MAIN_THREAD_DELAY_MS__: JSON.stringify(
          Number(process.env['COMP_LIB_MAIN_THREAD_DELAY_MS']),
        ),
        __HOST_RENDER_PAGE_DELAY_MS__: JSON.stringify(
          Number(process.env['HOST_RENDER_PAGE_DELAY_MS'] ?? 0),
        ),
      },
    }),
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginExternalBundle({
      externalsPresets: {
        reactlynx: {
          async: true,
        },
      },
      externals: {
        './App.js': 'comp-lib.web.bundle',
      },
      globalObject: 'globalThis',
    }),
    pluginLynxBundleAnalysisStats(),
  ],
  environments: {
    web: {},
  },
});
