import { defineConfig } from '@rsbuild/core';
import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';
import path from 'path';

export default defineConfig({
  source: {
    entry: {
      // index: './index.ts',
      'benches/create-view': './benches/create-view.ts',
    },
    // include: [/web/],
  },
  output: {
    target: 'web',
    distPath: {
      root: 'dist',
    },
    filenameHash: false,
    overrideBrowserslist: ['Chrome > 118'],
  },
  dev: {
    writeToDisk: true,
    hmr: false,
    liveReload: false,
  },
  tools: {
    htmlPlugin: true,
    rspack: {
      resolve: {
        fallback: {
          'module': false,
        },
      },
      // output: {
      //   publicPath: 'auto',
      // },
      plugins: [
        process.env.RSDOCTOR === 'true'
        && new RsdoctorRspackPlugin({
          supports: {
            generateTileGraph: true,
          },
        }),
      ],
      experiments: {
        futureDefaults: true,
      },
    },
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
    profile: true,
  },
  // plugins: [
  //   pluginWebPlatform({
  //     polyfill: false,
  //     nativeModulesPath: path.resolve(__dirname, './index.native-modules.ts'),
  //   }),
  // ],
});
