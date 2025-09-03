// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('lazyCompilation', () => {
  test('defaults', async () => {
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.lazyCompilation).toBeFalsy()
  })

  test('override with plugin', async () => {
    const rspeedy = await createStubRspeedy({
      plugins: [
        {
          name: 'test',
          setup(api) {
            api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
              return mergeRsbuildConfig(config, {
                dev: {
                  lazyCompilation: {
                    imports: true,
                  },
                },
              })
            })
          },
        } satisfies RsbuildPlugin,
      ],
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.lazyCompilation).toStrictEqual({
      imports: true,
    })
  })
})
