// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

vi
  .stubEnv('NODE_ENV', 'development')

describe('pluginReactLynx with react-refresh', () => {
  test('Inject refresh loader and plugin', async () => {
    const { pluginReactLynx } = await import('../src/index.js')
    const { ReactRefreshRspackPlugin } = await import(
      '@lynx-js/react-refresh-webpack-plugin'
    )

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        tools: {
          rspack: {
            output: {
              chunkFormat: 'commonjs',
            },
            resolve: {
              extensionAlias: {
                '.js': ['.ts', '.js'],
              },
            },
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [rspackConfig] = await rsbuild.initConfigs()

    expect(rspackConfig?.mode).toBe('development')
    expect(
      rspackConfig?.plugins?.some(plugin =>
        plugin instanceof ReactRefreshRspackPlugin
      ),
    ).toBe(true)
    expect(rspackConfig).toHaveLoader(ReactRefreshRspackPlugin.loader)
  })
})
