// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command } from 'commander'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { build } from '../../src/cli/build.js'

vi.mock(import('@rsbuild/core'), async (original) => {
  const core = await original()
  return {
    ...core,
    createRsbuild: vi.fn(),
    logger: {
      ...core.logger,
      error: vi.fn(),
    },
  }
})

describe('CLI - build', () => {
  const fixturesRoot = join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures',
  )

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('config not found', async () => {
    vi.mock('exit-hook')
    vi.useFakeTimers()

    const { gracefulExit } = await import('exit-hook')
    const core = await import('@rsbuild/core')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'config-not-found'),
      {},
    )

    expect(core.logger.error).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: expect.stringContaining(
          'Use custom config with `--config <config>` options.',
        ),
      }),
    )
    await vi.runAllTimersAsync()
    expect(vi.mocked(gracefulExit)).toBeCalledWith(1)

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
  })

  test('custom config not found', async () => {
    vi.mock('exit-hook')
    vi.useFakeTimers()

    const { gracefulExit } = await import('exit-hook')
    const core = await import('@rsbuild/core')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'config-not-found'),
      {
        config: 'non-exist-config.ts',
      },
    )

    expect(core.logger.error).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: expect.stringContaining('Cannot find config file:'),
      }),
    )
    expect(core.logger.error).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: expect.stringContaining('non-exist-config.ts'),
      }),
    )
    await vi.runAllTimersAsync()
    expect(vi.mocked(gracefulExit)).toBeCalledWith(1)

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
  })

  test('invalid config', async () => {
    vi.mock('exit-hook')
    vi.useFakeTimers()

    const { gracefulExit } = await import('exit-hook')
    const core = await import('@rsbuild/core')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'invalid-config'),
      {},
    )

    expect(core.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: expect.stringContaining(
          'Unknown property: `$input.nonExistConfig` in configuration',
        ),
      }),
    )
    await vi.runAllTimersAsync()
    expect(vi.mocked(gracefulExit)).toBeCalledWith(1)

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
  })

  test('createRsbuild', async () => {
    vi.mock('exit-hook')
    vi.useFakeTimers()

    const core = await import('@rsbuild/core')
    const { gracefulExit } = await import('exit-hook')

    vi.mocked(core.createRsbuild).mockImplementation(() =>
      // @ts-expect-error mock
      Promise.resolve({
        isPluginExists: vi.fn(),
        addPlugins: vi.fn(),
        build: vi.fn(),
        inspectConfig: vi.fn(),
      })
    )

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await vi.runAllTimersAsync()
    expect(vi.mocked(gracefulExit)).toBeCalledWith(0)
  })

  test('exit on RSDOCTOR="true" and CI!="false"', async () => {
    vi.stubEnv('CI', '1')
    vi.stubEnv('RSDOCTOR', 'true')
    vi.mock('exit-hook')
    vi.useFakeTimers()

    const core = await import('@rsbuild/core')
    core.createRsbuild = vi.fn().mockReturnValueOnce({
      build() {
        return Promise.resolve()
      },
      addPlugins() {
        return Promise.resolve()
      },
    })
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await vi.runAllTimersAsync()
    expect(vi.mocked(gracefulExit)).toBeCalledTimes(1)
  })

  test('no exit on RSDOCTOR="true" and CI="false"', async () => {
    vi.stubEnv('CI', 'false')
    vi.stubEnv('RSDOCTOR', 'true')
    vi.mock('exit-hook')
    vi.useFakeTimers()

    const core = await import('@rsbuild/core')
    core.createRsbuild = vi.fn().mockReturnValueOnce({
      build() {
        return Promise.resolve()
      },
      addPlugins() {
        return Promise.resolve()
      },
    })
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await vi.runAllTimersAsync()
    expect(vi.mocked(gracefulExit)).not.toBeCalled()
  })

  test('no exit on RSDOCTOR="true", CI="false" and build failed', async () => {
    vi.stubEnv('CI', 'false')
    vi.stubEnv('RSDOCTOR', 'true')
    vi.mock('exit-hook')
    vi.useFakeTimers()

    const core = await import('@rsbuild/core')
    core.createRsbuild = vi.fn().mockReturnValueOnce({
      build() {
        return Promise.reject(new Error('Mocked Build Error'))
      },
      addPlugins() {
        return Promise.resolve()
      },
    })
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await vi.runAllTimersAsync()
    expect(vi.mocked(gracefulExit)).not.toBeCalled()
  })

  test('exit on RSDOCTOR="true", CI!="false" and build failed', async () => {
    vi.stubEnv('CI', 'true')
    vi.stubEnv('RSDOCTOR', 'true')
    vi.mock('exit-hook')
    vi.useFakeTimers()

    const core = await import('@rsbuild/core')
    core.createRsbuild = vi.fn().mockReturnValueOnce({
      build() {
        return Promise.reject(new Error('Mocked Build Error'))
      },
      addPlugins() {
        return Promise.resolve()
      },
    })
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await vi.runAllTimersAsync()
    expect(vi.mocked(gracefulExit)).toBeCalled()
    expect(vi.mocked(gracefulExit)).toBeCalledWith(1)
  })

  describe('mode', () => {
    test('with NODE_ENV="production"', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      const core = await import('@rsbuild/core')
      core.createRsbuild = vi.fn().mockReturnValueOnce({
        build() {
          return Promise.reject(new Error('Mocked Build Error'))
        },
        addPlugins() {
          return Promise.resolve()
        },
      })

      const program = new Command('test')
      await build.call(
        program,
        join(fixturesRoot, 'hello-world'),
        {},
      )

      expect(core.createRsbuild).toBeCalledWith(expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        rsbuildConfig: expect.objectContaining({
          mode: undefined,
        }),
      }))
    })

    test('with --mode development', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      const core = await import('@rsbuild/core')
      core.createRsbuild = vi.fn().mockReturnValueOnce({
        build() {
          return Promise.reject(new Error('Mocked Build Error'))
        },
        addPlugins() {
          return Promise.resolve()
        },
      })

      const program = new Command('test')
      await build.call(
        program,
        join(fixturesRoot, 'hello-world'),
        {
          mode: 'development',
        },
      )

      expect(core.createRsbuild).toBeCalledWith(expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        rsbuildConfig: expect.objectContaining({
          mode: 'development',
        }),
      }))
    })

    test('with --mode none', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      const core = await import('@rsbuild/core')
      core.createRsbuild = vi.fn().mockReturnValueOnce({
        build() {
          return Promise.reject(new Error('Mocked Build Error'))
        },
        addPlugins() {
          return Promise.resolve()
        },
      })

      const program = new Command('test')
      await build.call(
        program,
        join(fixturesRoot, 'hello-world'),
        {
          mode: 'none',
        },
      )

      expect(core.createRsbuild).toBeCalledWith(expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        rsbuildConfig: expect.objectContaining({
          mode: 'none',
        }),
      }))
    })

    test('with --mode foo', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      const core = await import('@rsbuild/core')
      core.createRsbuild = vi.fn().mockReturnValueOnce({
        build() {
          return Promise.reject(new Error('Mocked Build Error'))
        },
        addPlugins() {
          return Promise.resolve()
        },
      })

      const program = new Command('test')
      await build.call(
        program,
        join(fixturesRoot, 'hello-world'),
        {
          // @ts-expect-error mocked wrong mode
          mode: 'foo',
        },
      )

      expect(core.createRsbuild).toBeCalledWith(expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        rsbuildConfig: expect.objectContaining({
          mode: 'foo',
        }),
      }))
    })
  })
})
