// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import { createRspeedy } from '../../../src/index.js'

describe('output.sourceMap', () => {
  test('does not set css source map by default', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {},
    })

    expect(rspeedy.getRspeedyConfig().output?.sourceMap).toBeUndefined()
  })

  test('respects output.sourceMap false', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        output: {
          sourceMap: false,
        },
      },
    })

    expect(rspeedy.getRspeedyConfig().output?.sourceMap).toBe(false)
  })

  test('respects output.sourceMap.css false', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        output: {
          sourceMap: {
            css: false,
          },
        },
      },
    })

    expect(rspeedy.getRspeedyConfig().output?.sourceMap).toEqual({
      css: false,
    })
  })

  test('keeps user js source map config', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        output: {
          sourceMap: {
            js: 'source-map',
          },
        },
      },
    })

    expect(rspeedy.getRspeedyConfig().output?.sourceMap).toEqual({
      js: 'source-map',
    })
  })
})
