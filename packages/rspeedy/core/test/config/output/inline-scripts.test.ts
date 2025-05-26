// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../../createStubRspeedy.js'

describe('output.inlineScripts', () => {
  test('defaults', async () => {
    const rspeedy = await createStubRspeedy({
      plugins: [
        {
          name: 'test',
          setup(api: RsbuildPluginAPI) {
            api.modifyRsbuildConfig((config) => {
              expect(config.output?.inlineScripts).toBe(true)
            })
            api.modifyBundlerChain((_, { environment }) => {
              expect(environment.config.output.inlineScripts).toBe(true)
            })
          },
        },
      ],
    })

    await rspeedy.initConfigs()

    expect.assertions(2)
  })

  test('output.inlineScripts: false', async () => {
    const rspeedy = await createStubRspeedy({
      output: {
        inlineScripts: false,
      },

      plugins: [
        {
          name: 'test',
          setup(api: RsbuildPluginAPI) {
            api.modifyRsbuildConfig((config) => {
              expect(config.output?.inlineScripts).toBe(false)
            })
            api.modifyBundlerChain((_, { environment }) => {
              expect(environment.config.output.inlineScripts).toBe(false)
            })
          },
        },
      ],
    })

    await rspeedy.initConfigs()

    expect.assertions(2)
  })
})
