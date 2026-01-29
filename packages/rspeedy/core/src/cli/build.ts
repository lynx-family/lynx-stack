// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import { logger } from '@rsbuild/core'
import type { Command } from 'commander'
import color from 'picocolors'

import type { CommonOptions } from './commands.js'
import { exit } from './exit.js'
import { createRspeedy } from '../create-rspeedy.js'
import { init } from './init.js'
import { getWatchedFiles, watchFiles } from './watch.js'
import { isCI } from '../utils/is-ci.js'

export type BuildOptions = CommonOptions & {
  environment?: string[] | undefined
  watch?: boolean | undefined
}

export async function build(
  this: Command,
  cwd: string,
  buildOptions: BuildOptions,
): Promise<void> {
  // We always exit on CI since `sass-embedded` will have child_processes that never exit.
  // Otherwise, we do not exit when Rsdoctor is enabled.
  const shouldExit = process.env['RSDOCTOR'] !== 'true' || isCI()
  const isWatch = buildOptions.watch ?? false

  if (buildOptions.logLevel) {
    logger.level = buildOptions.logLevel
  }

  let onBeforeRestart: (() => Promise<void>)[] = []
  try {
    const { rspeedyConfig, configPath, createRspeedyOptions } = await init(
      cwd,
      buildOptions,
    )

    if (isWatch) {
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
          await build.call(this, cwd, buildOptions)
        },
      )
    }

    const rspeedy = await createRspeedy(createRspeedyOptions)

    const { close } = await rspeedy.build({
      watch: isWatch,
    })

    if (isWatch) {
      onBeforeRestart.push(close)
    } else {
      await close()
    }
  } catch (error) {
    logger.error(error)
    if (shouldExit) {
      exit(1)
      return
    }
  }

  if (shouldExit && !isWatch) {
    exit()
  }
}
