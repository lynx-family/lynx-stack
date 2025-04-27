// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

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
}

export function apply(program: Command): Command {
  // TODO(cli): support custom cwd
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
    .action(
      (buildOptions: BuildOptions) =>
        import('./build.js').then(({ build }) =>
          build.call(buildCommand, cwd, buildOptions)
        ),
    )

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
    .action(
      (devOptions: DevOptions) =>
        import('./dev.js').then(({ dev }) =>
          dev.call(devCommand, cwd, devOptions)
        ),
    )

  const inspectCommand = program.command('inspect')
  inspectCommand
    .description('View the Rsbuild config and Rspack config of the project.')
    .option('--mode <mode>', 'specify the mode of Rsbuild', 'development')
    .option('--output <output>', 'specify inspect content output path')
    .option('--verbose', 'show full function definitions in output')
    .action((inspectOptions: InspectOptions) =>
      import('./inspect.js').then(({ inspect }) =>
        inspect.call(inspectCommand, cwd, inspectOptions)
      )
    )

  const previewCommand = program.command('preview')
  previewCommand
    .description('Preview the production build outputs locally.')
    .option('--base <base>', 'specify the base path of the server')
    .action((previewOptions: PreviewOptions) =>
      import('./preview.js').then(({ preview }) =>
        preview.call(previewCommand, cwd, previewOptions)
      )
    )

  const commonCommands = [
    devCommand,
    buildCommand,
    inspectCommand,
    previewCommand,
  ]
  commonCommands.forEach((command) => applyCommonOptions(command))

  return program
}
