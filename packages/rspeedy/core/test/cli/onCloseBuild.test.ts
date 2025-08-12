// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { join } from 'node:path'

import { Command } from 'commander'
import { describe, expect, test, vi } from 'vitest'

describe('onCloseBuild', () => {
  test('should call onCloseBuild hook when build is finished', async () => {
    vi.stubEnv('CI', 'true')
    vi.mock('../../src/cli/exit.js')
    const { exit } = await import('../../src/cli/exit.js')
    const { build } = await import('../../src/cli/build.js')
    const program = new Command('test')
    await build.call(program, join(__dirname, 'fixtures', 'onCloseBuild'), {})

    expect(exit).toBeCalledWith(1)
  })
})
