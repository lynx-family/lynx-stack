// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as core from '@rsbuild/core'
import { beforeEach, describe, expect, rstest, test } from '@rstest/core'
import { Command } from 'commander'
import { gracefulExit } from 'exit-hook'

import { apply } from '../../src/cli/commands.js'
import { main } from '../../src/cli/main.js'

// Automocking all of `@rsbuild/core` (`{ mock: true }`) deep-walks the whole
// module and blows the worker heap; stub only what the CLI touches.
rstest.mock('@rsbuild/core', () => {
  const actual = rstest.requireActual<typeof import('@rsbuild/core')>(
    '@rsbuild/core',
  )
  return {
    ...actual,
    createRsbuild: rstest.fn(),
    logger: {
      ...actual.logger,
      info: rstest.fn(),
      warn: rstest.fn(),
      error: rstest.fn(),
    },
  }
})
rstest.mock('exit-hook', { mock: true })

describe('CLI - main', () => {
  describe('NODE_ENV', () => {
    void beforeEach(() => {
      rstest.mocked(core.createRsbuild).mockClear()
      rstest.mocked(gracefulExit).mockClear()
      const NODE_ENV = process.env['NODE_ENV']
      delete process.env['NODE_ENV']
      return () => {
        process.env['NODE_ENV'] = NODE_ENV
      }
    })

    test('`rspeedy build` with NODE_ENV: test', async () => {
      rstest.stubEnv('NODE_ENV', 'test')

      await main(['node', 'rspeedy', 'build'])

      expect(process.env['NODE_ENV']).toBe('test')
    })

    test('`rspeedy build` without NODE_ENV', async () => {
      await main(['node', 'rspeedy', 'build'])

      expect(process.env['NODE_ENV']).toBe('production')
    })

    test('`rspeedy` without NODE_ENV', async () => {
      const NODE_ENV = process.env['NODE_ENV']
      delete process.env['NODE_ENV']

      await main(['node', 'rspeedy'])

      expect(process.env['NODE_ENV']).toBe('production')

      process.env['NODE_ENV'] = NODE_ENV
    })

    test('`rspeedy` with NODE_ENV: test', async () => {
      rstest.stubEnv('NODE_ENV', 'test')

      await main(['node', 'rspeedy'])

      expect(process.env['NODE_ENV']).toBe('test')
    })

    test('`rspeedy dev` without NODE_ENV', async () => {
      const NODE_ENV = process.env['NODE_ENV']
      delete process.env['NODE_ENV']

      await main(['node', 'rspeedy', 'dev'])

      expect(process.env['NODE_ENV']).toBe('development')

      process.env['NODE_ENV'] = NODE_ENV
    })

    test('`rspeedy info` without NODE_ENV', async () => {
      const NODE_ENV = process.env['NODE_ENV']
      delete process.env['NODE_ENV']

      await main(['node', 'rspeedy', 'info'])

      expect(process.env['NODE_ENV']).toBe('production')

      process.env['NODE_ENV'] = NODE_ENV
    })

    test('`rspeedy preview` without NODE_ENV', async () => {
      const NODE_ENV = process.env['NODE_ENV']
      delete process.env['NODE_ENV']

      await main(['node', 'rspeedy', 'preview'])

      expect(process.env['NODE_ENV']).toBe('development')

      process.env['NODE_ENV'] = NODE_ENV
    })
  })

  test('unknown command', () => {
    expect(() =>
      apply(new Command('test')).parse(['node', 'rspeedy', 'unknown'])
    )
      .toThrowErrorMatchingInlineSnapshot(
        `[CommanderError: error: unknown command 'unknown']`,
      )
  })

  test('suggestion command', () => {
    expect(() => apply(new Command('test')).parse(['node', 'rspeedy', 'bui']))
      .toThrowErrorMatchingInlineSnapshot(`
        [CommanderError: error: unknown command 'bui'
        (Did you mean build?)]
      `)
  })

  test('unknown options', () => {
    expect(() =>
      apply(new Command('test')).parse([
        'node',
        'rspeedy',
        '--non-exist-option',
      ])
    )
      .toThrowErrorMatchingInlineSnapshot(
        `[CommanderError: error: unknown option '--non-exist-option']`,
      )
  })
})
