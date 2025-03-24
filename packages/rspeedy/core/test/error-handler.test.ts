// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ErrorCategory,
  createBuildError,
  createConfigError,
  createDevServerError,
  enhanceError,
  logEnhancedError,
} from '../src/utils/error-handler.js'

// Import the mocked logger

// Mock the logger
vi.mock('@rsbuild/core', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Error Handler Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('enhanceError', () => {
    it('should return an EnhancedError if given a standard Error', () => {
      const error = new Error('Test error')
      const enhancedError = enhanceError(error)

      expect(enhancedError.message).toBe('Test error')
      expect(enhancedError.originalError).toBe(error)
    })

    it('should categorize dependency errors correctly', () => {
      const error = new Error('Cannot find module "test-module"')
      const enhancedError = enhanceError(error)

      expect(enhancedError.category).toBe(ErrorCategory.DEPENDENCY)
      expect(enhancedError.solutions.length).toBeGreaterThan(0)
    })

    it('should categorize file system errors correctly', () => {
      const error = new Error('ENOENT: no such file or directory')
      const enhancedError = enhanceError(error)

      expect(enhancedError.category).toBe(ErrorCategory.FILE_SYSTEM)
      expect(enhancedError.solutions.length).toBeGreaterThan(0)
    })

    it('should categorize port in use errors correctly', () => {
      const error = new Error('EADDRINUSE: port already in use')
      const enhancedError = enhanceError(error)

      expect(enhancedError.category).toBe(ErrorCategory.DEV_SERVER)
      expect(enhancedError.solutions.length).toBeGreaterThan(0)
    })

    it('should handle non-Error objects', () => {
      const enhancedError = enhanceError('string error')

      expect(enhancedError.message).toBe('string error')
      expect(enhancedError.category).toBe(ErrorCategory.UNKNOWN)
    })
  })

  describe('Error Creation Functions', () => {
    it('should create a config error with the right category and code', () => {
      const error = createConfigError('Config error', [{
        description: 'Fix your config',
      }])

      expect(error.category).toBe(ErrorCategory.CONFIG)
      expect(error.code).toBe('CONFIG_ERROR')
      expect(error.solutions[0]?.description).toBe('Fix your config')
    })

    it('should create a build error with the right category and code', () => {
      const error = createBuildError('Build error', [{
        description: 'Fix your build',
      }])

      expect(error.category).toBe(ErrorCategory.BUILD)
      expect(error.code).toBe('BUILD_ERROR')
      expect(error.solutions[0]?.description).toBe('Fix your build')
    })

    it('should create a dev server error with the right category and code', () => {
      const error = createDevServerError('Server error', [{
        description: 'Fix your server',
      }])

      expect(error.category).toBe(ErrorCategory.DEV_SERVER)
      expect(error.code).toBe('DEV_SERVER_ERROR')
      expect(error.solutions[0]?.description).toBe('Fix your server')
    })
  })

  describe('logEnhancedError', () => {
    it('should log the error message and category', () => {
      const error = createBuildError('Test error')
      logEnhancedError(error)

      expect(logger.error).toHaveBeenCalled()
      // Check that it includes the category and message
      const calls = vi.mocked(logger.error).mock.calls.flat().join(' ')
      expect(calls).toContain('Build')
      expect(calls).toContain('Test error')
    })

    it('should log solutions when available', () => {
      const error = createBuildError('Test error', [
        { description: 'Solution 1' },
        { description: 'Solution 2', code: 'npm fix' },
      ])

      logEnhancedError(error)

      expect(logger.info).toHaveBeenCalled()
      const calls = vi.mocked(logger.info).mock.calls.flat().join(' ')
      expect(calls).toContain('Solution 1')
      expect(calls).toContain('Solution 2')
      expect(calls).toContain('npm fix')
    })

    it('should log error code when present', () => {
      const error = createBuildError('Test error')
      logEnhancedError(error)

      expect(logger.error).toHaveBeenCalled()
      const calls = vi.mocked(logger.error).mock.calls.flat().join(' ')
      expect(calls).toContain('BUILD_ERROR')
    })
  })
})
