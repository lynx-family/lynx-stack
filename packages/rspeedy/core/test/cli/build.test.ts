// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, rstest, test } from '@rstest/core'
import { Command } from 'commander'

import { build } from '../../src/cli/build.js'

rstest.mock(import('@rsbuild/core'), () => {
  const core = rstest.requireActual<typeof import('@rsbuild/core')>(
    '@rsbuild/core',
  )
  return {
    ...core,
    createRsbuild: rstest.fn(),
    logger: {
      ...core.logger,
      error: rstest.fn(),
    },
  }
})

describe('CLI - build', () => {
  const fixturesRoot = join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures',
  )

  beforeEach(() => {
    rstest.restoreAllMocks()
  })

  test('config not found', async () => {
    rstest.mock('exit-hook', { mock: true })
    rstest.useFakeTimers()

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
    await rstest.runAllTimersAsync()
    expect(rstest.mocked(gracefulExit)).toBeCalledWith(1)

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
  })

  test('custom config not found', async () => {
    rstest.mock('exit-hook', { mock: true })
    rstest.useFakeTimers()

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
    await rstest.runAllTimersAsync()
    expect(rstest.mocked(gracefulExit)).toBeCalledWith(1)

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
  })

  test('invalid config', async () => {
    rstest.mock('exit-hook', { mock: true })
    rstest.useFakeTimers()

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
    await rstest.runAllTimersAsync()
    expect(rstest.mocked(gracefulExit)).toBeCalledWith(1)

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
  })

  test('createRsbuild', async () => {
    rstest.mock('exit-hook', { mock: true })
    rstest.useFakeTimers()

    const core = await import('@rsbuild/core')
    const { gracefulExit } = await import('exit-hook')

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
      // @ts-expect-error mock
      Promise.resolve({
        isPluginExists: rstest.fn(),
        addPlugins: rstest.fn(),
        build: rstest.fn(() =>
          Promise.resolve({
            close: rstest.fn(),
          })
        ),
        inspectConfig: rstest.fn(),
      })
    )

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await rstest.runAllTimersAsync()
    expect(rstest.mocked(gracefulExit)).toBeCalledWith(0)
  })

  test('exit on RSDOCTOR="true" and CI!="false"', async () => {
    rstest.stubEnv('CI', '1')
    rstest.stubEnv('RSDOCTOR', 'true')
    rstest.mock('exit-hook', { mock: true })
    rstest.useFakeTimers()

    const core = await import('@rsbuild/core')
    rstest.mocked(core.createRsbuild).mockReset().mockReturnValueOnce({
      build() {
        return Promise.resolve()
      },
      addPlugins() {
        return Promise.resolve()
      },
    } as never)
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await rstest.runAllTimersAsync()
    expect(rstest.mocked(gracefulExit)).toBeCalledTimes(1)
  })

  test('no exit on RSDOCTOR="true" and CI="false"', async () => {
    rstest.stubEnv('CI', 'false')
    rstest.stubEnv('RSDOCTOR', 'true')
    rstest.mock('exit-hook', { mock: true })
    rstest.useFakeTimers()

    const core = await import('@rsbuild/core')
    rstest.mocked(core.createRsbuild).mockReset().mockReturnValueOnce({
      build() {
        return Promise.resolve()
      },
      addPlugins() {
        return Promise.resolve()
      },
    } as never)
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await rstest.runAllTimersAsync()
    expect(rstest.mocked(gracefulExit)).not.toBeCalled()
  })

  test('no exit on RSDOCTOR="true", CI="false" and build failed', async () => {
    rstest.stubEnv('CI', 'false')
    rstest.stubEnv('RSDOCTOR', 'true')
    rstest.mock('exit-hook', { mock: true })
    rstest.useFakeTimers()

    const core = await import('@rsbuild/core')
    rstest.mocked(core.createRsbuild).mockReset().mockReturnValueOnce({
      build() {
        return Promise.reject(new Error('Mocked Build Error'))
      },
      addPlugins() {
        return Promise.resolve()
      },
    } as never)
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await rstest.runAllTimersAsync()
    expect(rstest.mocked(gracefulExit)).not.toBeCalled()
  })

  test('exit on RSDOCTOR="true", CI!="false" and build failed', async () => {
    rstest.stubEnv('CI', 'true')
    rstest.stubEnv('RSDOCTOR', 'true')
    rstest.mock('exit-hook', { mock: true })
    rstest.useFakeTimers()

    const core = await import('@rsbuild/core')
    rstest.mocked(core.createRsbuild).mockReset().mockReturnValueOnce({
      build() {
        return Promise.reject(new Error('Mocked Build Error'))
      },
      addPlugins() {
        return Promise.resolve()
      },
    } as never)
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await build.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    await rstest.runAllTimersAsync()
    expect(rstest.mocked(gracefulExit)).toBeCalled()
    expect(rstest.mocked(gracefulExit)).toBeCalledWith(1)
  })

  describe('watch mode', () => {
    test('with watch=true, process should not exit', async () => {
      rstest.mock('exit-hook', { mock: true })
      rstest.useFakeTimers()

      const core = await import('@rsbuild/core')
      const closeMock = rstest.fn().mockResolvedValue(undefined)

      rstest.mocked(core.createRsbuild).mockImplementation(() =>
        // @ts-expect-error mock
        Promise.resolve({
          isPluginExists: rstest.fn(),
          addPlugins: rstest.fn(),
          build: rstest.fn(() =>
            Promise.resolve({
              close: closeMock,
            })
          ),
          inspectConfig: rstest.fn(),
        })
      )

      const { gracefulExit } = await import('exit-hook')
      const processOnSpy = rstest.spyOn(process, 'on')

      const program = new Command('test')
      await build.call(
        program,
        join(fixturesRoot, 'hello-world'),
        { watch: true },
      )

      expect(closeMock).not.toHaveBeenCalled()
      await rstest.runAllTimersAsync()
      expect(rstest.mocked(gracefulExit)).not.toBeCalled()

      // Simulate SIGINT
      const sigintHandler = processOnSpy.mock.calls.find(call =>
        call[0] === 'SIGINT'
      )?.[1]
      if (sigintHandler) {
        sigintHandler()
        expect(closeMock).toHaveBeenCalledTimes(1)
      }

      processOnSpy.mockRestore()
    })

    test('with watch=false, process should exit and close should be called', async () => {
      rstest.mock('exit-hook', { mock: true })
      rstest.useFakeTimers()

      const core = await import('@rsbuild/core')
      const closeMock = rstest.fn().mockResolvedValue(undefined)

      rstest.mocked(core.createRsbuild).mockImplementation(() =>
        // @ts-expect-error mock
        Promise.resolve({
          isPluginExists: rstest.fn(),
          addPlugins: rstest.fn(),
          build: rstest.fn(() =>
            Promise.resolve({
              close: closeMock,
            })
          ),
          inspectConfig: rstest.fn(),
        })
      )

      const { gracefulExit } = await import('exit-hook')
      const processOnSpy = rstest.spyOn(process, 'on')

      const program = new Command('test')
      await build.call(
        program,
        join(fixturesRoot, 'hello-world'),
        { watch: false },
      )

      expect(closeMock).toHaveBeenCalledTimes(1)
      await rstest.runAllTimersAsync()
      expect(rstest.mocked(gracefulExit)).toBeCalledWith(0)
      processOnSpy.mockRestore()
    })
  })

  describe('mode', () => {
    test('with NODE_ENV="production"', async () => {
      rstest.stubEnv('NODE_ENV', 'production')

      const core = await import('@rsbuild/core')
      rstest.mocked(core.createRsbuild).mockReset().mockReturnValueOnce({
        build() {
          return Promise.reject(new Error('Mocked Build Error'))
        },
        addPlugins() {
          return Promise.resolve()
        },
      } as never)

      const program = new Command('test')
      await build.call(
        program,
        join(fixturesRoot, 'hello-world'),
        {},
      )

      expect(core.createRsbuild).toBeCalledWith(expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        rsbuildConfig: expect.objectContaining({
          mode: 'production',
        }),
      }))
    })

    test('with --mode development', async () => {
      rstest.stubEnv('NODE_ENV', 'production')

      const core = await import('@rsbuild/core')
      rstest.mocked(core.createRsbuild).mockReset().mockReturnValueOnce({
        build() {
          return Promise.reject(new Error('Mocked Build Error'))
        },
        addPlugins() {
          return Promise.resolve()
        },
      } as never)

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
      rstest.stubEnv('NODE_ENV', 'production')

      const core = await import('@rsbuild/core')
      rstest.mocked(core.createRsbuild).mockReset().mockReturnValueOnce({
        build() {
          return Promise.reject(new Error('Mocked Build Error'))
        },
        addPlugins() {
          return Promise.resolve()
        },
      } as never)

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
      rstest.stubEnv('NODE_ENV', 'production')

      const core = await import('@rsbuild/core')
      rstest.mocked(core.createRsbuild).mockReset().mockReturnValueOnce({
        build() {
          return Promise.reject(new Error('Mocked Build Error'))
        },
        addPlugins() {
          return Promise.resolve()
        },
      } as never)

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
