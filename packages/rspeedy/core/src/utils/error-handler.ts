// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import color from 'picocolors'

export enum ErrorCategory {
  CONFIG = 'Configuration',
  BUILD = 'Build',
  DEV_SERVER = 'Development Server',
  PLUGIN = 'Plugin',
  FILE_SYSTEM = 'File System',
  NETWORK = 'Network',
  DEPENDENCY = 'Dependency',
  UNKNOWN = 'Unknown',
}

export interface ErrorSolution {
  description: string
  code?: string
  url?: string
}

export interface EnhancedErrorOptions {
  category: ErrorCategory
  message: string
  solutions?: ErrorSolution[] | undefined
  originalError?: Error | undefined
  code?: string | undefined
  context?: Record<string, unknown> | undefined
}

export class EnhancedError extends Error {
  category: ErrorCategory
  solutions: ErrorSolution[]
  originalError?: Error | undefined
  code?: string | undefined
  context?: Record<string, unknown> | undefined

  constructor({
    category,
    message,
    solutions = [],
    originalError,
    code,
    context,
  }: EnhancedErrorOptions) {
    super(message)
    this.name = 'RSpeedyError'
    this.category = category
    this.solutions = solutions
    this.originalError = originalError
    this.code = code
    this.context = context
  }
}

/**
 * Formats and logs an enhanced error with solutions
 */
export function logEnhancedError(error: EnhancedError): void {
  logger.error(
    `\n${color.bgRed(color.white(' ERROR '))} ${
      color.bold(error.category)
    }: ${error.message}\n`,
  )

  if (error.code) {
    logger.error(`Error code: ${color.yellow(error.code)}`)
  }

  if (error.solutions.length > 0) {
    logger.info(`\n${color.green('Possible solutions:')}`)

    error.solutions.forEach((solution, index) => {
      logger.info(`  ${color.yellow(`${index + 1}.`)} ${solution.description}`)

      if (solution.code) {
        logger.info(`\n     ${color.dim(solution.code)}\n`)
      }

      if (solution.url) {
        logger.info(
          `     ${color.dim('Documentation:')} ${color.blue(solution.url)}`,
        )
      }
    })
  }

  if (error.originalError && process.env['DEBUG']) {
    logger.debug('\nOriginal error stack:')
    logger.debug(error.originalError.stack ?? error.originalError.message)
  }

  if (error.context && process.env['DEBUG']) {
    logger.debug('\nError context:')
    logger.debug(JSON.stringify(error.context, null, 2))
  }
}

/**
 * Creates a config error with helpful solutions
 */
export function createConfigError(
  message: string,
  solutions?: ErrorSolution[],
  originalError?: Error,
): EnhancedError {
  return new EnhancedError({
    category: ErrorCategory.CONFIG,
    message,
    solutions,
    originalError,
    code: 'CONFIG_ERROR',
  })
}

/**
 * Creates a build error with helpful solutions
 */
export function createBuildError(
  message: string,
  solutions?: ErrorSolution[],
  originalError?: Error,
): EnhancedError {
  return new EnhancedError({
    category: ErrorCategory.BUILD,
    message,
    solutions,
    originalError,
    code: 'BUILD_ERROR',
  })
}

/**
 * Creates a dev server error with helpful solutions
 */
export function createDevServerError(
  message: string,
  solutions?: ErrorSolution[],
  originalError?: Error,
): EnhancedError {
  return new EnhancedError({
    category: ErrorCategory.DEV_SERVER,
    message,
    solutions,
    originalError,
    code: 'DEV_SERVER_ERROR',
  })
}

/**
 * Creates a dependency error with helpful solutions
 */
export function createDependencyError(
  message: string,
  solutions?: ErrorSolution[],
  originalError?: Error,
): EnhancedError {
  return new EnhancedError({
    category: ErrorCategory.DEPENDENCY,
    message,
    solutions,
    originalError,
    code: 'DEPENDENCY_ERROR',
  })
}

/**
 * Wraps a standard error with enhanced error information when possible
 */
export function enhanceError(error: unknown): EnhancedError {
  if (error instanceof EnhancedError) {
    return error
  }

  const errorObj = error instanceof Error ? error : new Error(String(error))
  const message = errorObj.message

  // Attempt to categorize common errors
  if (message.includes('Cannot find module') || message.includes('not found')) {
    return createDependencyError(
      `Module not found: ${message}`,
      [
        {
          description: 'Install the missing dependency',
          code: 'npm install <package-name> --save',
        },
        {
          description: 'Check for typos in import statements',
        },
        {
          description: 'Verify the dependency is listed in package.json',
        },
      ],
      errorObj,
    )
  }

  if (message.includes('ENOENT') || message.includes('no such file')) {
    return new EnhancedError({
      category: ErrorCategory.FILE_SYSTEM,
      message: `File not found: ${message}`,
      solutions: [
        {
          description: 'Verify the file path is correct',
        },
        {
          description: 'Check if the file exists in the specified location',
        },
      ],
      originalError: errorObj,
      code: 'FILE_NOT_FOUND',
    })
  }

  if (message.includes('EADDRINUSE')) {
    return createDevServerError(
      'Port already in use',
      [
        {
          description: 'Try using a different port',
          code: 'npx rspeedy dev --port <different-port>',
        },
        {
          description: 'Stop the process using the current port and try again',
        },
      ],
      errorObj,
    )
  }

  // Default to unknown category
  return new EnhancedError({
    category: ErrorCategory.UNKNOWN,
    message,
    originalError: errorObj,
  })
}
