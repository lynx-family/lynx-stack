// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import type { Command } from 'commander'

import type { CommonOptions } from './commands.js'
import { exit } from './exit.js'
import { loadConfig } from '../config/loadConfig.js'
import { createRspeedy } from '../create-rspeedy.js'
import { isCI } from '../utils/is-ci.js'

export type BuildOptions = CommonOptions

export async function build(
  this: Command,
  cwd: string,
  buildOptions: BuildOptions,
): Promise<void> {
  // We always exit on CI since `sass-embedded` will have child_processes that never exit.
  // Otherwise, we do not exit when Rsdoctor is enabled.
  const shouldExit = process.env['RSDOCTOR'] !== 'true' || isCI()

  try {
    const { content: rspeedyConfig } = await loadConfig({
      cwd,
      configPath: buildOptions.config,
    })

    const rspeedy = await createRspeedy({
      cwd,
      rspeedyConfig,
      ...(buildOptions.envMode
        ? { loadEnv: { mode: buildOptions.envMode } }
        : {}),
    })

    await rspeedy.build()
  } catch (error) {
    logger.error(error)
    if (shouldExit) {
      exit(1)
      return
    }
  }

  if (shouldExit) {
    exit()
  }
}
