// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'

import { logger } from '@rsbuild/core'
import type { Command } from 'commander'
import color from 'picocolors'

import type { CommonOptions } from './commands.js'
import { exit } from './exit.js'
import { loadConfig, resolveConfigPath } from '../config/loadConfig.js'
import { createRspeedy } from '../create-rspeedy.js'
import type { CreateRspeedyOptions } from '../create-rspeedy.js'

export interface PreviewOptions extends CommonOptions {
  base?: string | undefined
}

export async function preview(
  this: Command,
  cwd: string,
  previewOptions: PreviewOptions,
): Promise<void> {
  try {
    const configPath = resolveConfigPath(cwd, previewOptions.config)

    const { content: rspeedyConfig } = await loadConfig({
      cwd,
      configPath,
    })

    if (previewOptions.base) {
      rspeedyConfig.server ??= {}
      rspeedyConfig.server.base = previewOptions.base
    }

    const options: CreateRspeedyOptions = {
      cwd,
      rspeedyConfig,
    }

    if (previewOptions.noEnv) {
      options.loadEnv = false
    } else if (previewOptions.envMode) {
      options.loadEnv = { mode: previewOptions.envMode }
    }

    const rspeedy = await createRspeedy(options)

    await rspeedy.initConfigs()

    const { distPath } = rspeedy.context

    if (!fs.existsSync(distPath)) {
      throw new Error(
        `The output directory ${
          color.yellow(distPath)
        } does not exist, please build the project before previewing.`,
      )
    }

    await rspeedy.preview()
  } catch (error) {
    logger.error('Failed to start preview server.')
    logger.error(error)
    exit(1)
    return
  }
}
