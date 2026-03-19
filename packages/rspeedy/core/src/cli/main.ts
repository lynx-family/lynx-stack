// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'

import { exit } from './exit.js'
import { debug } from '../debug.js'
import { rsbuildVersion, rspackVersion, version } from '../version.js'

function initNodeEnv(argv: string[]) {
  if (!process.env['NODE_ENV']) {
    const NODE_ENV = (argv.includes('dev') || argv.includes('preview'))
      ? 'development'
      : 'production'
    process.env['NODE_ENV'] = NODE_ENV
    debug(`No NODE_ENV found, set to ${NODE_ENV}`)
  }
}

export async function main(
  argv: string[],
): Promise<void> {
  initNodeEnv(argv)

  // If not called through a package manager,
  // output a blank line to keep the greet log nice.
  const { npm_execpath } = process.env
  if (
    !npm_execpath || npm_execpath.includes('npm-cli.js')
    || npm_execpath.includes('npx-cli.js')
  ) {
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log()
  }

  logger.greet(
    `  Rspeedy v${version} (Rsbuild v${rsbuildVersion}, Rspack v${rspackVersion})\n`,
  )

  try {
    const [
      { Command },
      { apply },
    ] = await Promise.all([
      import('commander'),
      import('./commands.js'),
    ])
    apply(new Command('rspeedy')).parse(argv)
  } catch {
    return exit(1)
  }
}
