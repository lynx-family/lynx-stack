// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'

import { beforeEach, describe, expect, rstest, test } from '@rstest/core'
import type { Mocked } from '@rstest/core'
import { Command } from 'commander'

import type { BuildOptions } from '../../src/cli/build.js'

rstest.mock('../../src/cli/build.js', () => ({
  build: rstest.fn().mockResolvedValue(undefined),
}))
rstest.mock('../../src/cli/dev.js', () => ({
  dev: rstest.fn().mockResolvedValue(undefined),
}))
rstest.mock('../../src/cli/inspect.js', () => ({
  inspect: rstest.fn().mockResolvedValue(undefined),
}))
rstest.mock('../../src/cli/preview.js', () => ({
  preview: rstest.fn().mockResolvedValue(undefined),
}))

describe('CLI - root option', () => {
  let program: Command
  let apply: (program: Command) => Command
  let mockedBuild: Mocked<
    (this: Command, cwd: string, buildOptions: BuildOptions) => Promise<void>
  >

  beforeEach(async () => {
    rstest.clearAllMocks()

    program = new Command('test')
    const commandsModule = await import('../../src/cli/commands.js')
    apply = commandsModule.apply
    program.exitOverride()
    const buildModule = await import('../../src/cli/build.js')
    mockedBuild = rstest.mocked(buildModule.build)
  })

  test('accepts short flag -r for root', async () => {
    const cliRootInput = './my-project'

    await apply(program).parseAsync([
      'node',
      'rspeedy',
      'build',
      '-r',
      cliRootInput,
    ])

    const [calledRoot] = mockedBuild.mock.calls[0]!

    expect(path.normalize(calledRoot)).toBe(
      path.normalize(path.resolve(process.cwd(), cliRootInput)),
    )
  })

  test('requires a value', async () => {
    const writeSpy = rstest.spyOn(process.stderr, 'write').mockImplementation(
      () => false,
    )

    await expect(
      apply(program).parseAsync(['node', 'rspeedy', 'build', '--root']),
    ).rejects.toThrow(/option ['"]?-r --root <root>['"]? .*argument missing/i)

    expect(mockedBuild).not.toHaveBeenCalled()

    writeSpy.mockRestore()
  })

  test('accepts a value', async () => {
    const cliRootInput = './some-path'
    await apply(program).parseAsync([
      'node',
      'rspeedy',
      'build',
      '--root',
      cliRootInput,
    ])

    const [calledRoot, calledOptions] = mockedBuild.mock.calls[0]!
    const actualRootPath = path.normalize(calledRoot)
    const expectedRootPath = path.normalize(
      path.resolve(process.cwd(), cliRootInput),
    )

    expect(actualRootPath).toBe(expectedRootPath)
    expect(calledOptions).toEqual(
      expect.objectContaining({ root: cliRootInput }),
    )
  })

  test('uses cwd when root is not provided', async () => {
    await apply(program).parseAsync(['node', 'rspeedy', 'build'])

    const [calledRoot, calledOptions] = mockedBuild.mock.calls[0]!
    const actualRootPath = path.normalize(calledRoot)
    const expectedRootPath = path.normalize(process.cwd())

    expect(actualRootPath).toBe(expectedRootPath)
    expect(calledOptions).toEqual(expect.objectContaining({}))
  })

  test('passes relative root path to build command', async () => {
    const cliRootInput = './my-project'
    await apply(program).parseAsync([
      'node',
      'rspeedy',
      'build',
      '--root',
      cliRootInput,
    ])

    const [calledRoot, calledOptions] = mockedBuild.mock.calls[0]!
    const actualRootPath = path.normalize(calledRoot)
    const expectedRootPath = path.normalize(
      path.resolve(process.cwd(), cliRootInput),
    )

    expect(actualRootPath).toBe(expectedRootPath)
    expect(calledOptions).toEqual(
      expect.objectContaining({ root: cliRootInput }),
    )
  })

  test('passes absolute root path to build command', async () => {
    const cliRootInput = path.resolve('/absolute/path/to/my-project')
    await apply(program).parseAsync([
      'node',
      'rspeedy',
      'build',
      '--root',
      cliRootInput,
    ])

    const [calledRoot, calledOptions] = mockedBuild.mock.calls[0]!
    const actualRootPath = path.normalize(calledRoot)
    const expectedRootPath = path.normalize(
      path.resolve(process.cwd(), cliRootInput),
    )

    expect(actualRootPath).toBe(expectedRootPath)
    expect(calledOptions).toEqual(
      expect.objectContaining({ root: cliRootInput }),
    )
  })

  test.each(['build', 'dev', 'inspect', 'preview'])(
    '%s command accepts --root option',
    async (command) => {
      const writeSpy = rstest.spyOn(process.stderr, 'write').mockImplementation(
        () => false,
      )
      await expect(
        apply(program).parseAsync([
          'node',
          'rspeedy',
          command,
          '--root',
          './my-project',
        ]),
      ).resolves.not.toThrow()

      writeSpy.mockRestore()
    },
  )

  test('works with both --root and --config options', async () => {
    const cliRootInput = './my-project'
    const cliConfigPath = './custom.config.js'
    await apply(program).parseAsync([
      'node',
      'rspeedy',
      'build',
      '--root',
      cliRootInput,
      '--config',
      cliConfigPath,
    ])

    const [calledRoot, calledOptions] = mockedBuild.mock.calls[0]!

    expect(path.normalize(calledRoot)).toBe(
      path.normalize(path.resolve(process.cwd(), cliRootInput)),
    )
    expect(calledOptions).toEqual(
      expect.objectContaining({
        root: cliRootInput,
        config: cliConfigPath,
      }),
    )
  })
})
