// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Command } from 'commander'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { apply } from '../../src/cli/commands.js'
import { main } from '../../src/cli/main.js'

describe('CLI - main', () => {
  describe('NODE_ENV', () => {
    vi.mock('@rsbuild/core')
    vi.mock('exit-hook')
    beforeEach(() => {
      const NODE_ENV = process.env['NODE_ENV']
      delete process.env['NODE_ENV']
      return () => {
        process.env['NODE_ENV'] = NODE_ENV
      }
    })

    test('`rspeedy build` with NODE_ENV: test', async () => {
      vi.stubEnv('NODE_ENV', 'test')

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
      vi.stubEnv('NODE_ENV', 'test')

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
