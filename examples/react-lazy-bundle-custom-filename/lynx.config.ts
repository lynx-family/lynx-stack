import { execSync } from 'node:child_process';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { pluginLazyBundleFilename } from './plugins/pluginLazyBundleFilename.js';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

// Resolve the short git commit hash to embed in the lazy bundle filename, so
// each build is traceable back to a commit.
const gitCommitHash = execSync('git rev-parse --short HEAD').toString().trim();

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    // Override the default lazy bundle filename (`async/[name].[fullhash].bundle`).
    // Here we also append the git commit hash so every lazy bundle is traceable.
    // Must be placed after `pluginReactLynx`, which registers the
    // `LynxTemplatePlugin` instances this plugin tweaks.
    pluginLazyBundleFilename({
      lazyBundleFilename: `my-lazy-bundles/[name].[fullhash]-${gitCommitHash}.bundle`,
    }),
  ],
  environments: {
    web: {},
    lynx: {
      performance: {
        profile: enableBundleAnalysis,
      },
    },
  },
});
