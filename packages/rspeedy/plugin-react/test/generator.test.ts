// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import { expect, test } from 'vitest'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

test('json generator in main-thread layer', async () => {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
  const rsbuild = await createRsbuild({
    rsbuildConfig: {
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
})
