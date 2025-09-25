// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import { Command } from 'commander'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../../src/cli/build.js', () => ({
  build: vi.fn().mockResolvedValue(undefined),
}))

describe('CLI - root option', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('requires a value', async () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() =>
      false
    )

    const program = new Command('test')
    const { apply } = await import('../../src/cli/commands.js')

    program.exitOverride()
    expect(() => {
      apply(program).parse(['node', 'rspeedy', 'build', '--root'])
    }).toThrow('error: option \'-r --root <root>\' argument missing')

    writeSpy.mockClear()
  })

  test('accepts a value', async () => {
    const program = new Command('test')
    const { apply } = await import('../../src/cli/commands.js')

    program.exitOverride()
    expect(() => {
      apply(program).parse([
        'node',
        'rspeedy',
        'build',
        '--root',
        './some-path',
      ])
    }).not.toThrow()
  })

  test('uses cwd when root is not provided', async () => {
    const program = new Command('test')
    const { apply } = await import('../../src/cli/commands.js')
    const { build } = await import('../../src/cli/build.js')

    program.exitOverride()
    await apply(program).parseAsync([
      'node',
      'rspeedy',
      'build',
    ])

    expect(build).toHaveBeenCalledWith(
      process.cwd(),
      expect.objectContaining({}),
    )
  })

  test('passes relative root path to build command', async () => {
    const program = new Command('test')
    const { apply } = await import('../../src/cli/commands.js')
    const { build } = await import('../../src/cli/build.js')

    program.exitOverride()
    await apply(program).parseAsync([
      'node',
      'rspeedy',
      'build',
      '--root',
      './my-project',
    ])

    expect(build).toHaveBeenCalledWith(
      path.resolve(process.cwd(), './my-project'),
      expect.objectContaining({ root: './my-project' }),
    )
  })
})
