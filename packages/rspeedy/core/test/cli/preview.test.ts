// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, rstest, test } from '@rstest/core'
import { Command } from 'commander'

import { preview } from '../../src/cli/preview.js'

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

describe('CLI - preview', () => {
  const fixturesRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'fixtures',
  )
  beforeEach(() => {
    rstest.resetAllMocks()
  })

  test('preview', async () => {
    const { createRsbuild } = await import('@rsbuild/core')

    const distPath = await mkdtemp(path.join(tmpdir(), 'rspeedy-test'))

    const mockedPreview = rstest.fn(() => {
      return { urls: [] }
    })

    rstest.mocked(createRsbuild).mockImplementation(() =>
      // @ts-expect-error mock
      Promise.resolve({
        isPluginExists: rstest.fn(),
        addPlugins: rstest.fn(),
        build: rstest.fn(),
        initConfigs: rstest.fn(),
        context: { distPath },
        preview: mockedPreview,
        inspectConfig: rstest.fn(),
      })
    )

    const program = new Command('test')

    await preview.call(
      program,
      path.join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(createRsbuild).toBeCalled()
    expect(mockedPreview).toBeCalled()
  })

  test('preview with loadConfig error', async () => {
    rstest.mock('exit-hook', { mock: true })

    const { gracefulExit } = await import('exit-hook')
    const { createRsbuild } = await import('@rsbuild/core')

    const program = new Command('test')

    await preview.call(
      program,
      path.join(fixturesRoot, 'invalid-config'),
      {},
    )

    expect(createRsbuild).not.toBeCalled()

    expect(gracefulExit).toBeCalled()
    expect(gracefulExit).toBeCalledTimes(1)
    expect(gracefulExit).toBeCalledWith(1)
  })

  test('preview with dist not found', async () => {
    rstest.mock('exit-hook', { mock: true })

    const { gracefulExit } = await import('exit-hook')
    const { createRsbuild } = await import('@rsbuild/core')

    const distPath = 'non-exist-path'

    const mockedPreview = rstest.fn(() => {
      return { urls: [] }
    })

    rstest.mocked(createRsbuild).mockImplementation(() =>
      // @ts-expect-error mock
      Promise.resolve({
        addPlugins: rstest.fn(),
        build: rstest.fn(),
        initConfigs: rstest.fn(),
        context: { distPath },
        preview: mockedPreview,
      })
    )

    const program = new Command('test')

    await preview.call(
      program,
      path.join(fixturesRoot, 'hello-world'),
      {},
    )

    expect(createRsbuild).toBeCalled()
    expect(mockedPreview).not.toBeCalled()

    expect(gracefulExit).toBeCalled()
    expect(gracefulExit).toBeCalledTimes(1)
    expect(gracefulExit).toBeCalledWith(1)
  })
})
