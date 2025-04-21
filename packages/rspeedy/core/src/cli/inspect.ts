// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import type { RsbuildMode } from '@rsbuild/core'
import type { Command } from 'commander'

import type { CommonOptions } from './commands.js'
import { exit } from './exit.js'
import { loadConfig } from '../config/loadConfig.js'
import { createRspeedy } from '../create-rspeedy.js'
import type { CreateRspeedyOptions } from '../create-rspeedy.js'

export interface InspectOptions extends CommonOptions {
  mode?: 'production' | 'development' | undefined
  verbose?: boolean | undefined
  output?: string | undefined
}

export async function inspect(
  this: Command,
  cwd: string,
  inspectOptions: InspectOptions,
): Promise<void> {
  try {
    const { content: rspeedyConfig } = await loadConfig({
      cwd,
      configPath: inspectOptions.config,
    })

    const options: CreateRspeedyOptions = {
      cwd,
      rspeedyConfig,
    }

    if (inspectOptions.noEnv) {
      options.loadEnv = false
    } else if (inspectOptions.envMode) {
      options.loadEnv = { mode: inspectOptions.envMode }
    }

    const rspeedy = await createRspeedy(options)

    await rspeedy.inspectConfig({
      mode: inspectOptions.mode
        ?? process.env['NODE_ENV'] as RsbuildMode
        ?? 'development',
      verbose: inspectOptions.verbose ?? false,
      outputPath: inspectOptions.output!,
      writeToDisk: true,
    })

    return exit()
  } catch (error) {
    logger.error(error)
    logger.error()
  }
}
