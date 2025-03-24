// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs/promises'
import path from 'node:path'

import { logger } from '@rsbuild/core'
import type { Command } from 'commander'

import type { CommonOptions } from './commands.js'
import { createRspeedy } from '../create-rspeedy.js'
import { exit } from './exit.js'
import {
  ErrorCategory,
  enhanceError,
  logEnhancedError,
} from '../utils/error-handler.js'

export interface DevOptions extends CommonOptions {
  port?: number
  host?: string
  open?: boolean
  https?: boolean
}

// Define the interfaces for important types
interface CreateRspeedyOptions {
  cwd: string
  config?: string
}

interface ServerInterface {
  restart: () => void
  urls: string[]
}

export async function dev(
  this: Command,
  cwd: string,
  options: DevOptions,
): Promise<void> {
  // Add options to the command
  this
    .option(
      '--port <port>',
      'specify the port to use for the dev server',
      Number.parseInt,
    )
    .option('--host <host>', 'specify the host to use for the dev server')
    .option('--open', 'open the browser automatically when the server starts')
    .option('--https', 'use HTTPS protocol')

  logger.info('Starting development server...')

  try {
    // Create RSpeedy instance with proper types
    const rspeedy = await createRspeedy({
      cwd,
      config: options.config,
    } as CreateRspeedyOptions)

    // Add interactive configuration options with explicit type assertion for StartDevServerOptions
    const devServerOptions = {
      port: options.port,
      host: options.host,
      open: options.open,
      https: options.https,
    } as unknown as Record<string, unknown>

    // Start the dev server with enhanced options using type assertion
    // This is necessary because the available typings don't match the actual API
    const server = await rspeedy.startDevServer(
      devServerOptions,
    ) as unknown as ServerInterface

    // Watch for tsconfig.json changes and restart the server if needed
    try {
      const tsconfigPath = path.join(cwd, 'tsconfig.json')
      if (await fs.stat(tsconfigPath).catch(() => false)) {
        // Use alternative approach with chokidar for file watching
        const { watch } = await import('node:fs')

        // Use Node.js fs.watch with type assertion since the API differs from the TypeScript definitions
        const watcher = watch(tsconfigPath) as unknown as {
          on(event: string, listener: (filename: string) => void): void
          close(): void
        }

        watcher.on('change', () => {
          logger.info('tsconfig.json changed, restarting server...')
          server.restart()
        })
      }
    } catch (error) {
      // Just log the error but don't exit
      logger.warn('Failed to watch tsconfig.json:', error)
    }

    const { urls } = server
    if (urls.length > 0) {
      logger.info('\nYou can now view your application in the browser:')
      urls.forEach(url => {
        logger.info(`  ${url}`)
      })
      logger.info('\n')
    }

    logger.info('Development server is running.')
    logger.info('Press Ctrl+C to stop the server')
  } catch (error) {
    const enhancedError = enhanceError(error)
    logEnhancedError(enhancedError)

    // Provide additional help for common development server issues
    if (enhancedError.category === ErrorCategory.DEV_SERVER) {
      logger.info('\nFor more help with development server issues, visit:')
      logger.info('https://lynxjs.org/rspeedy/troubleshooting\n')
    }

    exit(1)
  }
}
