// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { createRspeedy } from '../src/create-rspeedy.js'

describe('createRspeedy', () => {
  test('default callerName', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          {
            name: 'test',
            setup(api: RsbuildPluginAPI) {
              expect(api.context.callerName).toBe('rspeedy')
            },
          },
        ],
      },
    })

    await rspeedy.initConfigs()

    expect.assertions(1)
  })

  test('custom callerName', async () => {
    const rspeedy = await createRspeedy({
      callerName: 'my-custom-framework',
      rspeedyConfig: {
        plugins: [
          {
            name: 'test',
            setup(api: RsbuildPluginAPI) {
              expect(api.context.callerName).toBe('my-custom-framework')
            },
          },
        ],
      },
    })

    await rspeedy.initConfigs()

    expect.assertions(1)
  })
})
