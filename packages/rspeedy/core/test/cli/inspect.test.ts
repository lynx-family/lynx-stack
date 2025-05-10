// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { InspectConfigResult } from '@rsbuild/core'
import { Command } from 'commander'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Config, CreateRspeedyOptions } from '../../src/index.js'

vi.mock('../../src/cli/exit.js')
vi.mock('../../src/config/loadConfig.js')
vi.mock('../../src/create-rspeedy.js', async (original) => {
  const rsbuildCore = await original<
    typeof import('../../src/create-rspeedy.js')
  >()

  return {
    ...rsbuildCore,
    createRspeedy: vi.fn(async (options: CreateRspeedyOptions) => {
      const rsbuild = await rsbuildCore.createRspeedy(options)

      return {
        ...rsbuild,
        inspectConfig: vi.fn(rsbuild.inspectConfig.bind(rsbuild)),
      }
    }),
  }
})

describe('CLI - Inspect', () => {
  beforeEach(async () => {
    const { createRspeedy } = await import('../../src/create-rspeedy.js')

    vi.mocked(createRspeedy).mockClear()
    vi.unstubAllEnvs()
  })

  test('inspect with default options', async () => {
    const { loadConfig } = await import('../../src/config/loadConfig.js')

    await vi.mocked(loadConfig).withImplementation(
      () => Promise.resolve({ content: {}, configPath: '' }),
      async () => {
        vi.stubEnv('NODE_ENV', 'development')

        const { createRspeedy } = await import('../../src/create-rspeedy.js')
        const { inspect } = await import('../../src/cli/inspect.js')

        const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-test'))

        const program = new Command('test')

        await inspect.call(
          program,
          tmp,
          {},
        )

        expect(process.env['NODE_ENV']).toBe('development')

        expect(createRspeedy).toBeCalledTimes(1)

        const [rsbuild] = await Promise.all(
          vi.mocked(createRspeedy).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value),
        )

        expect(
          existsSync(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .toBeTruthy()
        await expect(
          import(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .resolves.toStrictEqual(expect.objectContaining({ default: {} }))

        expect(existsSync(path.join(
          tmp,
          'dist',
          '.rsbuild',
          'rsbuild.config.mjs',
        ))).toBeTruthy()

        expect(existsSync(path.join(
          tmp,
          'dist',
          '.rsbuild',
          'rspack.config.lynx.mjs',
        ))).toBeTruthy()

        expect(rsbuild).not.toBeUndefined()
        expect(rsbuild!.inspectConfig).toBeCalledTimes(1)

        const [inspectResult] = await Promise.all(
          vi.mocked(rsbuild!.inspectConfig).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value as Promise<InspectConfigResult>),
        )

        expect(inspectResult).not.toBeUndefined()

        expect(inspectResult).toHaveProperty(
          'rsbuildConfig',
          expect.any(String),
        )

        expect(inspectResult!.bundlerConfigs).toHaveLength(1)
      },
    )
  })

  test('inspect with env: production', async () => {
    const { loadConfig } = await import('../../src/config/loadConfig.js')

    await vi.mocked(loadConfig).withImplementation(
      () => Promise.resolve({ content: {}, configPath: '' }),
      async () => {
        vi.stubEnv('NODE_ENV', 'production')

        const { createRspeedy } = await import('../../src/create-rspeedy.js')
        const { inspect } = await import('../../src/cli/inspect.js')

        const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-test'))

        const program = new Command('test')

        await inspect.call(
          program,
          tmp,
          {
            mode: 'production',
          },
        )

        expect(createRspeedy).toBeCalledTimes(1)

        const [rsbuild] = await Promise.all(
          vi.mocked(createRspeedy).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value),
        )

        expect(
          existsSync(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .toBeTruthy()
        await expect(
          import(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .resolves.toStrictEqual(expect.objectContaining({
            default: {
              mode: 'production',
            },
          }))

        expect(existsSync(path.join(
          tmp,
          'dist',
          '.rsbuild',
          'rsbuild.config.mjs',
        ))).toBeTruthy()

        expect(existsSync(path.join(
          tmp,
          'dist',
          '.rsbuild',
          'rspack.config.lynx.mjs',
        ))).toBeTruthy()

        expect(rsbuild).not.toBeUndefined()
        expect(rsbuild!.inspectConfig).toBeCalledTimes(1)

        const [inspectResult] = await Promise.all(
          vi.mocked(rsbuild!.inspectConfig).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value as Promise<InspectConfigResult>),
        )

        expect(inspectResult).not.toBeUndefined()

        expect(inspectResult).toHaveProperty(
          'rsbuildConfig',
          expect.any(String),
        )

        expect(inspectResult!.bundlerConfigs).toHaveLength(1)
      },
    )
  })

  test('inspect with env: development', async () => {
    const { loadConfig } = await import('../../src/config/loadConfig.js')

    await vi.mocked(loadConfig).withImplementation(
      () => Promise.resolve({ content: {}, configPath: '' }),
      async () => {
        vi.stubEnv('NODE_ENV', 'development')
        const { createRspeedy } = await import('../../src/create-rspeedy.js')
        const { inspect } = await import('../../src/cli/inspect.js')

        const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-test'))

        const program = new Command('test')

        await inspect.call(
          program,
          tmp,
          {
            mode: 'development',
          },
        )

        expect(createRspeedy).toBeCalledTimes(1)

        const [rsbuild] = await Promise.all(
          vi.mocked(createRspeedy).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value),
        )

        expect(
          existsSync(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .toBeTruthy()
        await expect(
          import(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .resolves.toStrictEqual(expect.objectContaining({
            default: {
              mode: 'development',
            },
          }))

        expect(existsSync(path.join(
          tmp,
          'dist',
          '.rsbuild',
          'rsbuild.config.mjs',
        ))).toBeTruthy()

        expect(existsSync(path.join(
          tmp,
          'dist',
          '.rsbuild',
          'rspack.config.lynx.mjs',
        ))).toBeTruthy()

        expect(rsbuild).not.toBeUndefined()
        expect(rsbuild!.inspectConfig).toBeCalledTimes(1)

        const [inspectResult] = await Promise.all(
          vi.mocked(rsbuild!.inspectConfig).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value),
        )

        expect(inspectResult).not.toBeUndefined()

        expect(inspectResult).toHaveProperty(
          'rsbuildConfig',
          expect.any(String),
        )

        expect(inspectResult!.bundlerConfigs).toHaveLength(1)
      },
    )
  })

  test('inspect with verbose', async () => {
    const { loadConfig } = await import('../../src/config/loadConfig.js')

    await vi.mocked(loadConfig).withImplementation(
      () => Promise.resolve({ content: {}, configPath: '' }),
      async () => {
        vi.stubEnv('NODE_ENV', 'development')
        const { createRspeedy } = await import('../../src/create-rspeedy.js')
        const { inspect } = await import('../../src/cli/inspect.js')

        const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-test'))

        const program = new Command('test')

        await inspect.call(
          program,
          tmp,
          {
            verbose: true,
          },
        )

        expect(createRspeedy).toBeCalledTimes(1)

        const [rsbuild] = await Promise.all(
          vi.mocked(createRspeedy).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value),
        )

        expect(
          existsSync(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .toBeTruthy()
        await expect(
          import(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .resolves.toStrictEqual(expect.objectContaining({ default: {} }))

        expect(existsSync(path.join(
          tmp,
          'dist',
          '.rsbuild',
          'rsbuild.config.mjs',
        ))).toBeTruthy()

        expect(existsSync(path.join(
          tmp,
          'dist',
          '.rsbuild',
          'rspack.config.lynx.mjs',
        ))).toBeTruthy()

        expect(rsbuild).not.toBeUndefined()
        expect(rsbuild!.inspectConfig).toBeCalledTimes(1)

        const [inspectResult] = await Promise.all(
          vi.mocked(rsbuild!.inspectConfig).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value as Promise<InspectConfigResult>),
        )

        expect(inspectResult).not.toBeUndefined()

        expect(inspectResult).toHaveProperty(
          'rsbuildConfig',
          expect.any(String),
        )

        expect(inspectResult!.bundlerConfigs).toHaveLength(1)
      },
    )
  })

  test('inspect rspeedy config', async () => {
    const { loadConfig } = await import('../../src/config/loadConfig.js')

    await vi.mocked(loadConfig).withImplementation(
      () =>
        Promise.resolve(
          {
            configPath: '',
            content: { source: { alias: { foo: 'bar' } } } satisfies Config,
          },
        ),
      async () => {
        const { inspect } = await import('../../src/cli/inspect.js')

        const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-test'))

        const program = new Command('test')

        await inspect.call(
          program,
          tmp,
          {
            verbose: true,
          },
        )

        await expect(
          import(path.join(tmp, 'dist', '.rsbuild', 'rspeedy.config.js')),
        )
          .resolves.toStrictEqual(
            expect.objectContaining({
              default: { source: { alias: { foo: 'bar' } } },
            }),
          )
      },
    )
  })

  test('parse', async () => {
    const { loadConfig } = await import('../../src/config/loadConfig.js')

    await vi.mocked(loadConfig).withImplementation(
      () =>
        Promise.resolve(
          {
            configPath: '',
            content: { source: { alias: { foo: 'bar' } } } satisfies Config,
          },
        ),
      async () => {
        vi.stubEnv('NODE_ENV', 'development')
        const { createRspeedy } = await import('../../src/create-rspeedy.js')

        const { apply } = await import('../../src/cli/commands.js')

        await apply(new Command('test')).parseAsync([
          'node',
          'rspeedy',
          'inspect',
          '--output',
          './dist',
          '--config',
          'foo/bar/config.js',
        ])

        expect(loadConfig).toBeCalledWith(expect.objectContaining({
          configPath: 'foo/bar/config.js',
        }))

        expect(createRspeedy).toBeCalledTimes(1)

        const [rsbuild] = await Promise.all(
          vi.mocked(createRspeedy).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value),
        )

        expect(rsbuild).not.toBeUndefined()
        expect(rsbuild!.inspectConfig).toBeCalledTimes(1)

        const [inspectResult] = await Promise.all(
          vi.mocked(rsbuild!.inspectConfig).mock.results
            .filter(i => i.type === 'return')
            .map(i => i.value as Promise<InspectConfigResult>),
        )

        expect(inspectResult!.origin.rsbuildConfig.source.alias).toHaveProperty(
          'foo',
          'bar',
        )
      },
    )
  })
})
