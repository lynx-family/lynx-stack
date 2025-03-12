// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Command } from 'commander'
import { logger } from 'rslog'

import { install } from './install.js'
import { version } from './version.js'

export async function main(
  cwd?: string,
  argv?: readonly string[],
): Promise<void> {
  const program = new Command('upgrade-rspeedy')

  // If not called through a package manager,
  // output a blank line to keep the greet log nice.
  const { npm_execpath } = process.env
  if (
    !npm_execpath || npm_execpath.includes('npm-cli.js')
    || npm_execpath.includes('npx-cli.js')
  ) {
    console.info()
  }

  logger.greet(`Upgrade Rspeedy v${version}\n`)

  program
    .helpCommand(false)
    .description('Upgrade the Rspeedy-related packages')
    .action(() => install(cwd ?? process.cwd()))

  await program.parseAsync(argv)
}
