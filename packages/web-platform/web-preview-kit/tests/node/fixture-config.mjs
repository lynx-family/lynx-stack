// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The Rsbuild configuration of a project, set up the way the bundle kit
// configures one. Every line that differs from a plain
// `pluginReactLynx()` project is an override the bundle kit has to apply as
// well; they are marked OVERRIDE.
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

/**
 * @param {object} options
 * @param {string} options.root the project directory
 * @param {string} options.distPath where to write the output
 * @param {Record<string, string>} options.entries card name to entry module
 * @param {'development' | 'production'} options.mode
 * @param {boolean} options.hmr
 * @param {string} [options.publicPath] the URL the assets are served from
 * @returns {import('@rsbuild/core').RsbuildConfig}
 */
export function projectConfig(
  { root, distPath, entries, mode, hmr, publicPath },
) {
  const development = mode === 'development';
  return {
    root,
    mode,
    source: {
      entry: Object.fromEntries(
        Object.entries(entries).map(([name, entry]) => [name, `./${entry}`]),
      ),
    },
    output: {
      distPath: { root: distPath },
      cleanDistPath: true,
      // OVERRIDE: production builds request their chunks and static assets
      // from where the kit serves them.
      ...(publicPath ? { assetPrefix: publicPath } : {}),
    },
    dev: {
      // OVERRIDE: `hmr` of the protocol drives both; with them off a
      // development bundle has no HMR client.
      hmr: development && hmr,
      liveReload: development && hmr,
      // OVERRIDE: the hot-update runtime fetches updates from
      // `publicPath + <name>.<hash>.hot-update.json`, so it has to be the URL
      // the Service Worker serves the instance at.
      ...(publicPath ? { assetPrefix: publicPath } : {}),
    },
    // OVERRIDE: only the `web` environment; the default is `lynx`.
    environments: { web: {} },
    tools: {
      bundlerChain(chain) {
        // OVERRIDE: without this ProvidePlugin the HMR client of
        // `@lynx-js/webpack-dev-transport` falls back to
        // `LynxTransportClient`, which reads dev-server messages from
        // `lynx.getDevtool()`, where the kit sends them. With it, the client
        // would open a WebSocket to a dev server that does not exist.
        chain.plugins.delete('lynx.hmr.provide.dev_server_client');
      },
    },
    plugins: [pluginReactLynx()],
  };
}
