// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  PLUGIN_TYPE_CHECK_NAME,
  pluginTypeCheck,
} from '@rsbuild/plugin-type-check'
import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

function countTypeCheckers(config: { plugins?: unknown[] }): number {
  return (config.plugins ?? []).filter(
    (plugin) =>
      (plugin as { constructor?: { name?: string } })?.constructor?.name
        === 'TsCheckerRspackPlugin',
  ).length
}

describe('typeCheck.plugin', () => {
  test('apply type-check by default', async () => {
    const rsbuild = await createStubRspeedy({})

    expect(rsbuild.isPluginExists(PLUGIN_TYPE_CHECK_NAME)).toBe(true)

    const config = await rsbuild.unwrapConfig()
    expect(countTypeCheckers(config)).toBe(1)
  })

  test('should not apply the built-in type-check when user provides one', async () => {
    // The user's plugin disables type checking. If the built-in one were
    // applied unconditionally, an enabled checker would still be present.
    const rsbuild = await createStubRspeedy({
      plugins: [pluginTypeCheck({ enable: false })],
    })

    const config = await rsbuild.unwrapConfig()
    expect(countTypeCheckers(config)).toBe(0)
  })
})
