import { defineConfig } from '@rsbuild/core';
import { codecovWebpackPlugin } from '@codecov/webpack-plugin';
const codecovEnabled = !!process.env.CI;
console.info('codecov enabled:', codecovEnabled);
export default defineConfig({
  source: {
    entry: {
      index: './index.ts',
    },
  },
  output: {
    target: 'web',
    distPath: {
      root: 'dist',
    },
    filenameHash: false,
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
      output: {
        publicPath: 'auto',
      },
      plugins: [
        codecovWebpackPlugin({
          enableBundleAnalysis: codecovEnabled,
          bundleName: '@lynx-js/web-explorer',
          uploadToken: process.env.CODECOV_TOKEN,
          telemetry: codecovEnabled,
          uploadOverrides: {
            sha: process.env.GITHUB_SHA,
          },
        }),
      ],
    },
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
    profile: true,
  },
});
