// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin } from '@rsbuild/core'
import { Command } from 'commander'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { dev } from '../../src/cli/dev.js'

vi.mock('exit-hook')
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

vi.mock('chokidar', async () => {
  const { EventEmitter } = await import('eventemitter3')

  const emitter = new EventEmitter()

  // @ts-expect-error mock
  emitter.close = function() {
    emitter.removeAllListeners()
    return Promise.resolve()
  }

  return {
    default: {
      emitter,
      watch: vi.fn(() => {
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
    vi.restoreAllMocks()
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

    const close = vi.fn(() => {
      return Promise.resolve()
    })

    vi.mocked(core.createRsbuild).mockImplementationOnce(() =>
      Promise.resolve({
        isPluginExists: vi.fn(),
        addPlugins: vi.fn(),
        // @ts-expect-error mock
        createDevServer: vi.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        inspectConfig: vi.fn(),
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

    const close = vi.fn(() => {
      return Promise.resolve()
    })

    vi.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        addPlugins: vi.fn(),
        // @ts-expect-error mock
        createDevServer: vi.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        inspectConfig: vi.fn(),
      })
    )

    const exit = vi
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
    expect(vi.mocked(gracefulExit)).toBeCalled()
    expect(vi.mocked(gracefulExit)).toBeCalledWith(130)
  })

  test('force shutdown', async () => {
    await import('../../src/cli/exit.js')
    const core = await import('@rsbuild/core')

    const close = vi.fn(() => {
      return Promise.resolve()
    })

    vi.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        addPlugins: vi.fn(),
        // @ts-expect-error mock
        createDevServer: vi.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        inspectConfig: vi.fn(),
      })
    )

    const exit = vi
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

    vi.mocked(chokidar.default.watch).mockClear()

    const close = vi.fn(() => {
      return Promise.resolve()
    })

    vi.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        // @ts-expect-error mock
        createDevServer: vi.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        addPlugins: vi.fn(),
        inspectConfig: vi.fn(),
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

    vi.mocked(chokidar.default.watch).mockClear()

    const close = vi.fn(() => {
      return Promise.resolve()
    })

    vi.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        // @ts-expect-error mock
        createDevServer: vi.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        addPlugins: vi.fn(),
        inspectConfig: vi.fn(),
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

    vi.mocked(chokidar.default.watch).mockClear()

    const close = vi.fn(() => {
      return Promise.resolve()
    })

    const plugins: string[] = []

    vi.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        // @ts-expect-error mock
        createDevServer: vi.fn(() =>
          Promise.resolve({
            listen: () => ({ server: { close } }),
          })
        ),
        addPlugins: vi.fn().mockImplementation((p: RsbuildPlugin[]) => {
          plugins.push(...p.filter(p => Boolean(p)).map(p => p.name))
        }),
        isPluginExists: vi.fn().mockImplementation((name: string) =>
          plugins.includes(name)
        ),
        inspectConfig: vi.fn(),
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

    const close = vi.fn(() => {
      return Promise.resolve()
    })

    vi.mocked(core.createRsbuild).mockImplementation(() =>
      Promise.resolve({
        // @ts-expect-error mock
        createDevServer: vi.fn(() =>
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

    expect(vi.mocked(core.createRsbuild).mock.calls.length).toBeGreaterThan(1)
  })
})
