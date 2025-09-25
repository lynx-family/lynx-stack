// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import type { RsbuildMode } from '@rsbuild/core'
import type { Command } from 'commander'

import type { BuildOptions } from './build.js'
import type { DevOptions } from './dev.js'
import type { InspectOptions } from './inspect.js'
import type { PreviewOptions } from './preview.js'
import { version } from '../version.js'

export interface CommonOptions {
  config?: string
  envMode?: string
  noEnv?: boolean
  mode?: RsbuildMode
  root?: string
}

function applyCommonOptions(command: Command) {
  command
    .option(
      '-c --config <config>',
      'specify the configuration file, can be a relative or absolute path',
    )
    .option(
      '--env-mode <mode>',
      'specify the env mode to load the .env.[mode] file',
    )
    .option(
      '--no-env',
      'disable loading `.env` files"',
    )
    .option(
      '-m --mode <mode>',
      'specify the build mode, can be `development`, `production` or `none`',
    )
    .option(
      '-r --root <root>',
      'set the project root directory (absolute path or relative to cwd)',
    )
}

function resolveRoot(cwd: string, root?: string): string {
  if (!root) return cwd
  return path.isAbsolute(root) ? root : path.resolve(cwd, root)
}

export function apply(program: Command): Command {
  const cwd = process.cwd()

  program
    .name('rspeedy')
    .usage('<command> [options]')
    .version(version)
    .option(
      '--unmanaged',
      'Force to use the unmanaged version of Rspeedy, instead of the locally installed.',
    )
    .showHelpAfterError(true)
    .showSuggestionAfterError(true)
    .exitOverride() // Avoid calling `process.exit` by commander

  const buildCommand = program.command('build')
  buildCommand
    .description('Build the project in production mode')
    .option(
      '--environment <name...>',
      'specify the name of environment to build',
    )
    .option(
      '--watch',
      'Enable watch mode to automatically rebuild on file changes',
    )
    .action(async (buildOptions: BuildOptions) => {
      const actualRoot = resolveRoot(cwd, buildOptions.root)
      const { build } = await import('./build.js')
      return await build.call(buildCommand, actualRoot, buildOptions)
    })

  const devCommand = program.command('dev')
  devCommand
    .description(
      'Run the dev server and watch for source file changes while serving.',
    )
    .option('--base <base>', 'specify the base path of the server')
    .option(
      '--environment <name...>',
      'specify the name of environment to build',
    )
    .action(async (devOptions: DevOptions) => {
      const actualRoot = resolveRoot(cwd, devOptions.root)
      const { dev } = await import('./dev.js')
      return await dev.call(devCommand, actualRoot, devOptions)
    })

  const inspectCommand = program.command('inspect')
  inspectCommand
    .description('View the Rsbuild config and Rspack config of the project.')
    .option('--output <output>', 'specify inspect content output path')
    .option('--verbose', 'show full function definitions in output')
    .action(async (inspectOptions: InspectOptions) => {
      const actualRoot = resolveRoot(cwd, inspectOptions.root)
      const { inspect } = await import('./inspect.js')
      return await inspect.call(inspectCommand, actualRoot, inspectOptions)
    })

  const previewCommand = program.command('preview')
  previewCommand
    .description('Preview the production build outputs locally.')
    .option('--base <base>', 'specify the base path of the server')
    .action(async (previewOptions: PreviewOptions) => {
      const actualRoot = resolveRoot(cwd, previewOptions.root)
      const { preview } = await import('./preview.js')
      return await preview.call(previewCommand, actualRoot, previewOptions)
    })

  const commonCommands = [
    devCommand,
    buildCommand,
    inspectCommand,
    previewCommand,
  ]
  commonCommands.forEach((command) => applyCommonOptions(command))

  return program
}
