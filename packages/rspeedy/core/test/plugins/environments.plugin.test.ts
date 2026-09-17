// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import type { Config } from '../../src/index.js'
import { createStubRspeedy } from '../createStubRspeedy.js'

describe('Plugins - Environments', () => {
  test.each<{
    name: string
    environments: Config['environments']
    expected: string[]
  }>([
    { name: 'default', environments: undefined, expected: ['lynx'] },
    { name: 'empty', environments: {}, expected: ['web'] },
    { name: 'web', environments: { web: {} }, expected: ['web'] },
    {
      name: 'web and lynx',
      environments: { web: {}, lynx: {} },
      expected: ['web', 'lynx'],
    },
  ])('$name', async ({ environments, expected }) => {
    const rspeedy = await createStubRspeedy({ environments })

    await rspeedy.initConfigs()

    expect(Object.keys(rspeedy.getNormalizedConfig().environments))
      .toStrictEqual(expected)
  })
})
