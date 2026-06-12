// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as core from '@rsbuild/core'
import { beforeEach, describe, expect, rstest, test } from '@rstest/core'
import { Command } from 'commander'
import { gracefulExit } from 'exit-hook'

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
rstest.mock('exit-hook', { mock: true })

describe('CLI - preview', () => {
  const fixturesRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'fixtures',
  )
  void beforeEach(() => {
    rstest.resetAllMocks()
  })

  test('preview', async () => {
    const distPath = await mkdtemp(path.join(tmpdir(), 'rspeedy-test'))

    const mockedPreview = rstest.fn(() => {
      return { urls: [] }
    })

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
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

    expect(core.createRsbuild).toBeCalled()
    expect(mockedPreview).toBeCalled()
  })

  test('preview with loadConfig error', async () => {
    const program = new Command('test')

    await preview.call(
      program,
      path.join(fixturesRoot, 'invalid-config'),
      {},
    )

    expect(core.createRsbuild).not.toBeCalled()

    expect(gracefulExit).toBeCalled()
    expect(gracefulExit).toBeCalledTimes(1)
    expect(gracefulExit).toBeCalledWith(1)
  })

  test('preview with dist not found', async () => {
    const distPath = 'non-exist-path'

    const mockedPreview = rstest.fn(() => {
      return { urls: [] }
    })

    rstest.mocked(core.createRsbuild).mockImplementation(() =>
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

    expect(core.createRsbuild).toBeCalled()
    expect(mockedPreview).not.toBeCalled()

    expect(gracefulExit).toBeCalled()
    expect(gracefulExit).toBeCalledTimes(1)
    expect(gracefulExit).toBeCalledWith(1)
  })
})
