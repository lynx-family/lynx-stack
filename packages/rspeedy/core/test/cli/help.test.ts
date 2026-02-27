// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'

import { Command } from 'commander'
import { describe, expect, test, vi } from 'vitest'

const require = createRequire(import.meta.url)

describe('CLI - help', () => {
  test('help message', async () => {
    // Optional. Suppress normal output to keep test output clean.
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() =>
      false
    )
    const program = new Command().configureHelp({
      helpWidth: 80,
    })

    const { apply } = await import('../../src/cli/commands.js')

    apply(program)

    expect(program.helpInformation()).toMatchInlineSnapshot(`
      "Usage: rspeedy <command> [options]

      Options:
        -V, --version      output the version number
        -h, --help         display help for command

      Commands:
        build [options]    Build the project in production mode
        dev [options]      Run the dev server and watch for source file changes while
                           serving.
        inspect [options]  View the Rsbuild config and Rspack config of the project.
        preview [options]  Preview the production build outputs locally.
        help [command]     display help for command
      "
    `)
    writeSpy.mockClear()
  })

  test('`help` command', async () => {
    // Optional. Suppress normal output to keep test output clean.
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() =>
      false
    )

    const program = new Command('test')

    const { apply } = await import('../../src/cli/commands.js')

    program
      .exitOverride()
    expect(() => {
      apply(program).parse(['node', 'rspeedy', 'help'])
    }).toThrow('(outputHelp)')

    writeSpy.mockClear()
  })

  test('option `--help`', async () => {
    // Optional. Suppress normal output to keep test output clean.
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() =>
      false
    )

    const program = new Command('test')

    const { apply } = await import('../../src/cli/commands.js')

    program
      .exitOverride()
    expect(() => {
      apply(program).parse(['node', 'rspeedy', '--help'])
    }).toThrow('(outputHelp)')

    writeSpy.mockClear()
  })

  test('options `--version`', async () => {
    // Optional. Suppress normal output to keep test output clean.
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() =>
      false
    )

    const pkg = require(
      '../../package.json',
    ) as typeof import('../../package.json')

    const program = new Command('test')

    const { apply } = await import('../../src/cli/commands.js')

    program
      .exitOverride()
    expect(() => {
      apply(program).parse(['node', 'rspeedy', '--version'])
    }).toThrow(pkg.version)

    writeSpy.mockClear()
  })

  test('options `-V`', async () => {
    // Optional. Suppress normal output to keep test output clean.
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() =>
      false
    )

    const pkg = require(
      '../../package.json',
    ) as typeof import('../../package.json')

    const program = new Command('test')

    const { apply } = await import('../../src/cli/commands.js')

    program
      .exitOverride()
    expect(() => {
      apply(program).parse(['node', 'rspeedy', '-V'])
    }).toThrow(pkg.version)

    writeSpy.mockClear()
  })
})
