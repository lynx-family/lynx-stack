// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { type defineConfig } from '@lynx-js/rspeedy';

const port = process.env['PORT'] ?? 3080;
const enableSSR = !!process.env['ENABLE_SSR'];

export function commonConfig(
  reactlynxConfigs?: Parameters<typeof pluginReactLynx>[0],
): Parameters<typeof defineConfig>[0] {
  return {
    plugins: [
      pluginReactLynx({
        enableSSR,
        firstScreenSyncTiming: enableSSR ? 'jsReady' : 'immediately',
        ...reactlynxConfigs,
      }),
    ],
    output: {
      distPath: {
        root: enableSSR ? 'dist/ssr' : 'dist',
      },
      filename: '[name]/index.[platform].json',
      cleanDistPath: false,
      assetPrefix: `http://localhost:${port}/dist`,
    },
    environments: {
      web: {},
    },
    performance: {
      chunkSplit: {
        strategy: 'all-in-one',
      },
    },
  };
}
