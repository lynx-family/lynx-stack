// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'

import { logger } from '@rsbuild/core'
import type { Command } from 'commander'
import color from 'picocolors'

import type { CommonOptions } from './commands.js'
import { exit } from './exit.js'
import { createRspeedy } from '../create-rspeedy.js'
import { init } from './init.js'

export interface PreviewOptions extends CommonOptions {
  base?: string | undefined
}

export async function preview(
  this: Command,
  cwd: string,
  previewOptions: PreviewOptions,
): Promise<void> {
  try {
    const {
      createRspeedyOptions,
      rspeedyConfig,
    } = await init(cwd, previewOptions)

    const rspeedy = await createRspeedy(createRspeedyOptions)

    // When using `rspeedy preview --mode=production`, the `lynx:rsbuild:dev` plugin will not be loaded.
    if (!rspeedy.isPluginExists('lynx:rsbuild:dev')) {
      const { applyDefaultDevPlugins } = await import('../plugins/index.js')
      await applyDefaultDevPlugins(rspeedy, rspeedyConfig)
    }

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
