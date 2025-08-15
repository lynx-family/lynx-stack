// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from 'vitest'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

test('json generator in main-thread layer', async () => {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      plugins: [
        pluginStubRspeedyAPI(),
        pluginReactLynx(),
      ],
    },
  })

  const [config] = await rsbuild.initConfigs()

  expect(config!.module!.rules).toContainEqual({
    test: /\.json$/,
    type: 'json',
    issuerLayer: LAYERS.MAIN_THREAD,
    generator: {
      JSONParse: false,
    },
  })
  expect(config!.module!.rules).not.toContainEqual({
    test: /\.json$/,
    type: 'json',
    issuerLayer: LAYERS.BACKGROUND,
    generator: {
      JSONParse: false,
    },
  })
})

test('json generator in dual-thread layer when extractStr is enabled', async () => {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      plugins: [
        pluginStubRspeedyAPI(),
        pluginReactLynx({
          extractStr: true,
        }),
      ],
    },
  })

  const [config] = await rsbuild.initConfigs()

  expect(config!.module!.rules).toContainEqual({
    test: /\.json$/,
    type: 'json',
    generator: {
      JSONParse: false,
    },
  })
})
