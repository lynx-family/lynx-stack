// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import type { Command } from 'commander'

import type { CommonOptions } from './commands.js'
import { createRspeedy } from '../create-rspeedy.js'
import { exit } from './exit.js'
import {
  createBuildError,
  enhanceError,
  logEnhancedError,
} from '../utils/error-handler.js'
import { displayPerformanceDashboard } from '../utils/performance-dashboard.js'

export interface BuildOptions extends CommonOptions {
  dashboard?: boolean
}

export async function build(
  this: Command,
  cwd: string,
  options: BuildOptions,
): Promise<void> {
  // Add options to the command
  this
    .option('--dashboard', 'display detailed build performance metrics')

  const showDashboard = options.dashboard !== false

  logger.info('Starting the production build...')

  try {
    const startTime = Date.now()

    // Define more specific types
    interface RspeedyOptions {
      cwd: string
      config?: string
    }

    interface BuildResult {
      isSuccessful: boolean
      stats?: {
        assets?: Array<{ name: string, size: number, chunkNames?: string[] }>
        errors?: unknown[]
        warnings?: unknown[]
      }
      duration?: number
    }

    const rspeedy = await createRspeedy({
      cwd,
      config: options.config,
    } as RspeedyOptions)

    const result = await rspeedy.build() as unknown as BuildResult
    const endTime = Date.now()
    const buildTime = endTime - startTime

    if (result.isSuccessful) {
      logger.success(
        `Build complete in ${Math.floor(buildTime / 1000)}s!\n`,
      )

      if (showDashboard && result.stats) {
        // Extract metrics from build results
        const stats = result.stats as unknown as {
          assets?: Array<{ name: string, size: number, chunkNames?: string[] }>
          errors?: unknown[]
          warnings?: unknown[]
        }

        // Add type assertions to handle potential undefined values safely
        const assets = stats?.assets?.map(asset => ({
          name: asset.name,
          size: asset.size,
          isInitial: asset.chunkNames?.includes('main') ?? false,
        })) ?? []

        const totalSize = assets.reduce(
          (sum: number, asset) => sum + asset.size,
          0,
        )

        displayPerformanceDashboard({
          totalTime: buildTime,
          totalSize,
          assets,
          errors: stats?.errors?.length ?? 0,
          warnings: stats?.warnings?.length ?? 0,
        })
      }
    } else {
      throw createBuildError('Build failed', [
        {
          description: 'Check the webpack build errors above for more details',
        },
        {
          description: 'Verify your source code for syntax errors',
        },
        {
          description: 'Check for import/export issues in your modules',
        },
      ])
    }
  } catch (error) {
    const enhancedError = enhanceError(error)
    logEnhancedError(enhancedError)
    exit(1)
  }

  exit(0)
}
