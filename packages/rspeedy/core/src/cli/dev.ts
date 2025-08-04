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

    const watchedFiles = [configPath]

    if (Array.isArray(rspeedyConfig.dev?.watchFiles)) {
      watchedFiles.push(
        ...rspeedyConfig.dev.watchFiles
          .filter(item => item.type === 'reload-server')
          .flatMap(item => item.paths),
      )
    } else if (rspeedyConfig.dev?.watchFiles?.type === 'reload-server') {
      const { paths } = rspeedyConfig.dev.watchFiles
      watchedFiles.push(...Array.isArray(paths) ? paths : [paths])
    }

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

async function watchFiles(
  files: string[],
  callback: (
    filePath: string,
    startTime: number,
    event: string,
  ) => Promise<void>,
) {
  const chokidar = await import('chokidar')
  const watcher = chokidar.default.watch(files, {
    // do not trigger add for initial files
    ignoreInitial: true,
    // If watching fails due to read permissions, the errors will be suppressed silently.
    ignorePermissionErrors: true,
  })

  const cb = debounce(
    (event: string, filePath: string) => {
      const startTime = Date.now()
      void watcher.close().then(() => callback(filePath, startTime, event))
    },
    // set 300ms debounce to avoid restart frequently
    300,
  )

  watcher.once('add', cb.bind(null, 'add'))
  watcher.once('change', cb.bind(null, 'change'))
  watcher.once('unlink', cb.bind(null, 'unlink'))
}

// biome-ignore lint/suspicious/noExplicitAny: Make TS happy
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func(...args)
    }, wait)
  }
}
