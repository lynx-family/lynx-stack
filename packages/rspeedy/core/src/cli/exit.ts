// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import { asyncExitHook, gracefulExit } from 'exit-hook'
import color from 'picocolors'

import { debug } from '../debug.js'
import { enhanceError, logEnhancedError } from '../utils/error-handler.js'

const start = Date.now()

const exitPromises: Promise<void>[] = []

const unsubscribe = asyncExitHook(onExit, { wait: 1000 })

// eslint-disable-next-line @typescript-eslint/no-misused-promises
process.on('unhandledRejection', async (reason) => {
  const enhancedError = enhanceError(reason)
  logEnhancedError(enhancedError)

  // Here we do not directly use `gracefulExit` since it will wait until
  // the compilation finished.
  unsubscribe()
  await onExit(1)
  // eslint-disable-next-line n/no-process-exit
  process.exit(1)
})

let interrupted = false
process.on('SIGINT', () => {
  if (interrupted) {
    logger.info(`Force exiting Rspeedy.`)
    // The `exit` is not complete, yet.
    // But the `Ctrl + C` has been pressed again, we make a force exit here.
    // eslint-disable-next-line n/no-process-exit
    return process.exit(/** 128 + 2(kill) */ 130)
  }

  interrupted = true
  logger.info(
    `Gracefully shutting down. Please wait... (Press ${
      color.cyan('Ctrl+C')
    } again to force exit)`,
  )

  // Graceful exit with code 130
  // see: https://nodejs.org/docs/latest/api/process.html#signal-events
  exit(/** 128 + 2(kill) */ 130)
})

let previousSignal: number | null = null

export const exit = (signal: number | undefined = 0): void => {
  if (previousSignal !== null) {
    debug(
      `graceful exit called multiple times, current: ${signal}, previous: ${previousSignal}`,
    )
  }

  previousSignal = signal
  debug(`graceful exit process with signal: ${signal}`)
  gracefulExit(signal)
}

async function onExit(signal: number) {
  const duration = Date.now() - start
  debug(`exit hook fired with signal: ${signal}, duration: ${duration}`)

  debug(`awaiting exit promises(length: ${exitPromises.length})...`)
  await Promise.allSettled(exitPromises)
}
