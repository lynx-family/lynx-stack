// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import color from 'picocolors'

import { formatBytes } from './format-bytes.js'

export interface AssetInfo {
  name: string
  size: number
  isInitial?: boolean
}

export interface ModuleInfo {
  name: string
  size: number
  dependencies?: string[]
}

export interface BuildMetrics {
  totalTime: number
  totalSize: number
  assets: AssetInfo[]
  modules?: ModuleInfo[]
  errors: number
  warnings: number
}

/**
 * Format the duration in a human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Display a performance dashboard in the console
 */
export function displayPerformanceDashboard(metrics: BuildMetrics): void {
  const { totalTime, totalSize, assets, errors, warnings } = metrics

  // Header
  logger.info('\n')
  logger.info(
    color.bold(color.bgBlue(color.white(' BUILD PERFORMANCE METRICS '))),
  )
  logger.info('\n')

  // Build summary
  logger.info(
    `${color.bold('Build Time:')} ${color.yellow(formatDuration(totalTime))}`,
  )
  logger.info(
    `${color.bold('Total Size:')} ${color.yellow(formatBytes(totalSize))}`,
  )
  logger.info(`${color.bold('Status:')} ${
    errors > 0
      ? color.red(`${errors} errors, ${warnings} warnings`)
      : (warnings > 0
        ? color.yellow(`${warnings} warnings`)
        : color.green('Success'))
  }`)

  logger.info('\n')

  // Asset table header
  logger.info(color.bold('Assets:'))
  logger.info('-'.repeat(80))
  logger.info(color.dim(
    `${padRight('Name', 50)} ${padRight('Size', 15)} ${padRight('Status', 10)}`,
  ))
  logger.info('-'.repeat(80))

  // Sort assets by size (largest first)
  const sortedAssets = [...assets].sort((a, b) => b.size - a.size)

  // Asset table rows
  sortedAssets.forEach(asset => {
    const name = asset.name.length > 47
      ? asset.name.substring(0, 44) + '...'
      : asset.name

    const size = formatBytes(asset.size)
    const status = asset.isInitial
      ? color.green('initial')
      : color.yellow('async')

    logger.info(`${padRight(name, 50)} ${padRight(size, 15)} ${status}`)
  })

  logger.info('-'.repeat(80))
  logger.info('\n')

  // Recommendations
  provideOptimizationRecommendations(metrics)
}

/**
 * Provide optimization recommendations based on build metrics
 */
function provideOptimizationRecommendations(metrics: BuildMetrics): void {
  const { totalTime, totalSize, assets } = metrics
  const recommendations: string[] = []

  // Check for large bundles
  const largeAssets = assets.filter(asset =>
    asset.size > 500 * 1024 && asset.isInitial
  )
  if (largeAssets.length > 0) {
    recommendations.push(
      'Consider code splitting for large bundles to improve initial load time.',
    )
  }

  // Check for slow build time
  if (totalTime > 10000) {
    recommendations.push(
      'Build time is high. Consider using incremental builds or optimizing your webpack configuration.',
    )
  }

  // Check for overall bundle size
  if (totalSize > 2 * 1024 * 1024) {
    recommendations.push(
      'Total bundle size is large. Consider implementing tree-shaking, code splitting, or removing unused dependencies.',
    )
  }

  // Output recommendations
  if (recommendations.length > 0) {
    logger.info(color.bold('Optimization Recommendations:'))
    recommendations.forEach((rec, index) => {
      logger.info(`${color.yellow(index + 1)}. ${rec}`)
    })
    logger.info('\n')
    logger.info(
      `For more optimization tips, visit: ${
        color.blue('https://lynxjs.org/rspeedy/optimization')
      }`,
    )
    logger.info('\n')
  }
}

/**
 * Pad a string to the right with spaces to reach the specified length
 */
function padRight(str: string, length: number): string {
  return str.padEnd(length, ' ')
}
