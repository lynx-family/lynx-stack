// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin } from '@rsbuild/core'
import { beforeEach, describe, expect, rstest, test } from '@rstest/core'
import { Command } from 'commander'

import { dev } from '../../src/cli/dev.js'

rstest.mock('exit-hook', { mock: true })
rstest.mock('@rsbuild/core', () => {
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

rstest.mock('chokidar', () => {
  const { EventEmitter } = rstest.requireActual<typeof import('eventemitter3')>(
    'eventemitter3',
  )

  const emitter = new EventEmitter()

  // @ts-expect-error mock
  emitter.close = function() {
    emitter.removeAllListeners()
    return Promise.resolve()
  }

  return {
    default: {
      emitter,
      watch: rstest.fn(() => {
        return emitter
      }),
    },
  }
})

describe('CLI - dev', () => {
  const fixturesRoot = join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures',
  )

  beforeEach(() => {
    rstest.restoreAllMocks()
  })

  test('config not found', async () => {
    const core = await import('@rsbuild/core')
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await dev.call(
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

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
    expect(gracefulExit).toBeCalledWith(1)
  })

  test('custom config not found', async () => {
    const core = await import('@rsbuild/core')
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await dev.call(
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

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
    expect(gracefulExit).toBeCalledWith(1)
  })

  test('invalid config', async () => {
    const core = await import('@rsbuild/core')
    const { gracefulExit } = await import('exit-hook')

    const program = new Command('test')
    await dev.call(
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

    // createRsbuild should not be called
    expect(core.createRsbuild).not.toBeCalled()
    expect(gracefulExit).toBeCalledWith(1)
  })

  test('createRsbuild', async () => {
    const core = await import('@rsbuild/core')
    const { gracefulExit } = await import('exit-hook')

    const close = rstest.fn(() => {
      return Promise.resolve()
    })

    rstest.mocked(core.createRsbuild).mockImplementationOnce(() =>
      Promise.resolve({
        isPluginExists: rstest.fn(),
        addPlugins: rstest.fn(),
        // @ts-expect-error mock
        createDevServer: rstest.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        inspectConfig: rstest.fn(),
      })
    )

    const program = new Command('test')
    await dev.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)

    expect(1).toBe(1)
    expect(gracefulExit).not.toBeCalled()
  })

  test('gracefully shutdown', async () => {
    await import('../../src/cli/exit.js')
    const core = await import('@rsbuild/core')
    const { gracefulExit } = await import('exit-hook')

    const close = rstest.fn(() => {
      return Promise.resolve()
    })

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        addPlugins: rstest.fn(),
        // @ts-expect-error mock
        createDevServer: rstest.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        inspectConfig: rstest.fn(),
      })
    )

    const exit = rstest
      .spyOn(process, 'exit')
      // @ts-expect-error mocked exit
      .mockImplementation(() => {
        return 0
      })

    const program = new Command('test')
    await dev.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )
    expect(core.createRsbuild).toBeCalledTimes(1)
    process.emit('SIGINT')
    expect(exit).not.toBeCalled()
    expect(rstest.mocked(gracefulExit)).toBeCalled()
    expect(rstest.mocked(gracefulExit)).toBeCalledWith(130)
  })

  test('force shutdown', async () => {
    await import('../../src/cli/exit.js')
    const core = await import('@rsbuild/core')

    const close = rstest.fn(() => {
      return Promise.resolve()
    })

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        addPlugins: rstest.fn(),
        // @ts-expect-error mock
        createDevServer: rstest.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        inspectConfig: rstest.fn(),
      })
    )

    const exit = rstest
      .spyOn(process, 'exit')
      // @ts-expect-error mocked exit
      .mockImplementation(() => {
        return 0
      })

    const program = new Command('test')
    await dev.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )
    expect(core.createRsbuild).toBeCalledTimes(1)
    process.emit('SIGINT')
    process.emit('SIGINT')
    expect(exit).toBeCalled()
    expect(exit).toBeCalledWith(130)
  })

  test('dev.watchFiles(array) with `type: "reload-server"`', async () => {
    const core = await import('@rsbuild/core')
    const chokidar = await import('chokidar')

    rstest.mocked(chokidar.default.watch).mockClear()

    const close = rstest.fn(() => {
      return Promise.resolve()
    })

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        // @ts-expect-error mock
        createDevServer: rstest.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        addPlugins: rstest.fn(),
        inspectConfig: rstest.fn(),
      })
    )

    const root = join(fixturesRoot, 'watch-files')

    const program = new Command('test')
    await dev.call(
      program,
      root,
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    expect(chokidar.default.watch).toBeCalledWith(
      [
        'lynx.config.js',
        'foo.js',
        'bar.js',
        'baz.js',
      ].map(name => join(root, name)),
      {
        ignoreInitial: true,
        ignorePermissionErrors: true,
      },
    )
  })

  test('dev.watchFiles(object) with `type: "reload-server"`', async () => {
    const core = await import('@rsbuild/core')
    const chokidar = await import('chokidar')

    rstest.mocked(chokidar.default.watch).mockClear()

    const close = rstest.fn(() => {
      return Promise.resolve()
    })

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        // @ts-expect-error mock
        createDevServer: rstest.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        addPlugins: rstest.fn(),
        inspectConfig: rstest.fn(),
      })
    )

    const root = join(fixturesRoot, 'watch-files')

    const program = new Command('test')
    await dev.call(
      program,
      root,
      { config: './object.js' },
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    expect(chokidar.default.watch).toBeCalledWith(
      [
        'object.js',
        'bar.js',
        'baz.js',
      ].map(name => join(root, name)),
      {
        ignoreInitial: true,
        ignorePermissionErrors: true,
      },
    )
  })

  test('dev with --mode=production', async () => {
    const core = await import('@rsbuild/core')
    const chokidar = await import('chokidar')

    rstest.mocked(chokidar.default.watch).mockClear()

    const close = rstest.fn(() => {
      return Promise.resolve()
    })

    const plugins: string[] = []

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        // @ts-expect-error mock
        createDevServer: rstest.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        addPlugins: rstest.fn().mockImplementation((p: RsbuildPlugin[]) => {
          plugins.push(...p.filter(p => Boolean(p)).map(p => p.name))
        }),
        isPluginExists: rstest.fn().mockImplementation((name: string) =>
          plugins.includes(name)
        ),
        inspectConfig: rstest.fn(),
      })
    )

    const program = new Command('test')
    await dev.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {
        mode: 'production',
      },
    )

    expect(core.createRsbuild).toBeCalledTimes(1)
    expect(plugins).toContain('lynx:rsbuild:dev')
  })

  // TODO: re-enable this flaky test
  test.skip('restart devServer when lynx.config.ts changes', async () => {
    const core = await import('@rsbuild/core')
    const chokidar = await import('chokidar')

    const close = rstest.fn(() => {
      return Promise.resolve()
    })

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        // @ts-expect-error mock
        createDevServer: rstest.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
      })
    )

    const program = new Command('test')
    await dev.call(
      program,
      join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(core.createRsbuild).toBeCalledTimes(1)

    // @ts-expect-error mocked emitter
    const { emitter } = chokidar.default as {
      emitter: import('eventemitter3').EventEmitter
    }

    await Promise.resolve()

    emitter.emit('change', 'lynx.config.ts')
    emitter.emit('change', 'lynx.config.ts')
    emitter.emit('change', 'lynx.config.ts')

    await new Promise<void>(resolve => setTimeout(resolve, 1000))
    expect(close).toBeCalledTimes(1)

    await new Promise<void>(resolve => setTimeout(resolve, 1000))

    expect(rstest.mocked(core.createRsbuild).mock.calls.length).toBeGreaterThan(
      1,
    )
  })
})
