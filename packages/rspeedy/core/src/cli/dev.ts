// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import { logger } from '@rsbuild/core'
import type { Command } from 'commander'
import color from 'picocolors'

import type { CommonOptions } from './commands.js'
import { createRspeedy } from '../create-rspeedy.js'
import { exit } from './exit.js'
import { init } from './init.js'
import { getWatchedFiles, watchFiles } from './watch.js'

export interface DevOptions extends CommonOptions {
  base?: string | undefined
  environment?: string[] | undefined
}

export async function dev(
  this: Command,
  cwd: string,
  devOptions: DevOptions,
): Promise<void> {
  let onBeforeRestart: (() => Promise<void>)[] = []
  try {
    const { rspeedyConfig, configPath, createRspeedyOptions } = await init(
      cwd,
      devOptions,
    )

    const watchedFiles = getWatchedFiles(configPath, rspeedyConfig)

    await watchFiles(
      watchedFiles.map(filePath =>
        path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)
      ),
      async (filename) => {
        logger.info(`Restart because ${color.yellow(filename)} is changed.\n`)
        const cleanup = onBeforeRestart.map(f => f())
        onBeforeRestart = []

        await Promise.all(cleanup)
        await dev.call(this, cwd, devOptions)
      },
    )

    const rspeedy = await createRspeedy(createRspeedyOptions)

    const server = await rspeedy.createDevServer()

    const { server: { close } } = await server.listen()

    onBeforeRestart.push(close)
  } catch (error) {
    logger.error(error)
    exit(1)
  }
}
