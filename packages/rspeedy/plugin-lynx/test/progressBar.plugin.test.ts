// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'

describe('pluginProgressBar', () => {
  test('defaults dev.progressBar to true', async () => {
    const rsbuild = await createStubRsbuild()
    await rsbuild.initConfigs()
    expect(rsbuild.getNormalizedConfig().dev.progressBar).toBe(true)
  })

  test.each([false, { id: 'foo' }])(
    'keeps a user-set dev.progressBar %o',
    async (progressBar) => {
      const rsbuild = await createStubRsbuild({ dev: { progressBar } })
      await rsbuild.initConfigs()
      expect(rsbuild.getNormalizedConfig().dev.progressBar).toStrictEqual(
        progressBar,
      )
    },
  )
})
