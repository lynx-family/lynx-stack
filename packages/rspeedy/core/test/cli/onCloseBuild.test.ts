// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { join } from 'node:path'

import { describe, expect, rstest, test } from '@rstest/core'
import { Command } from 'commander'

describe('onCloseBuild', () => {
  test('should call onCloseBuild hook when build is finished', async () => {
    rstest.stubEnv('CI', 'true')
    rstest.mock('../../src/cli/exit.js', { mock: true })
    const { exit } = await import('../../src/cli/exit.js')
    const { build } = await import('../../src/cli/build.js')
    const program = new Command('test')
    await build.call(program, join(__dirname, 'fixtures', 'onCloseBuild'), {})

    expect(exit).toBeCalledWith(1)
  })
})
