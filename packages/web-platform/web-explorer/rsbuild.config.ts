import { defineConfig, type RsbuildPluginAPI } from '@rsbuild/core';
import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';
import { writeFileSync } from 'node:fs';
import path from 'path';

const BUNDLE_STATS_JSON_OPTIONS = {
  assets: true,
  chunks: true,
  modules: true,
  entrypoints: true,
  chunkGroups: true,
} as const;

const statsJsonPlugin = {
  name: 'web-explorer:stats-json',
  setup(api: RsbuildPluginAPI) {
    if (!process.env.RSPEEDY_BUNDLE_ANALYSIS) {
      return;
    }

    api.onAfterBuild(({ stats }) => {
      if (!stats) {
        return;
      }
      writeFileSync(
        path.join(api.context.distPath, 'stats.json'),
        JSON.stringify(stats.toJson(BUNDLE_STATS_JSON_OPTIONS), null, 2),
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
