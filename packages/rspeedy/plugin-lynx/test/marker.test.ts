// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'
import { PLUGIN_LYNX_NAME } from '../src/index.js'

describe('PLUGIN_LYNX_NAME', () => {
  test('marks pluginLynx as applied', async () => {
    const rsbuild = await createStubRsbuild()
    await rsbuild.unwrapConfig()

    expect(rsbuild.isPluginExists(PLUGIN_LYNX_NAME)).toBe(true)
  })
})
