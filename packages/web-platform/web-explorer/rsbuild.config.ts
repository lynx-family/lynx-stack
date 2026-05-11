import { defineConfig } from '@rsbuild/core';
import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';
import { writeFileSync } from 'node:fs';
import path from 'path';

const statsJsonPlugin = {
  name: 'web-explorer:stats-json',
  setup(api) {
    if (!process.env.RSPEEDY_BUNDLE_ANALYSIS) {
      return;
    }

    api.onAfterBuild(({ stats }) => {
      if (!stats) {
        return;
      }
      writeFileSync(
        path.join(api.context.distPath, 'stats.json'),
        JSON.stringify(stats.toJson({ all: true }), null, 2),
      );
    });
  },
};

export default defineConfig({
  source: {
    entry: {
      index: './index.ts',
    },
    include: [/web/],
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
  html: {},
  tools: {
    htmlPlugin: false,
    rspack: {
      resolve: {
        fallback: {
          'module': false,
        },
      },
      output: {
        publicPath: 'auto',
      },
      plugins: [
        process.env.RSDOCTOR === 'true'
        && new RsdoctorRspackPlugin({
          supports: {
            generateTileGraph: true,
          },
        }),
      ],
    },
  },
  splitChunks: false,
  plugins: [
    statsJsonPlugin,
    pluginWebPlatform({
      polyfill: false,
      nativeModulesPath: path.resolve(__dirname, './index.native-modules.ts'),
    }),
  ],
});
