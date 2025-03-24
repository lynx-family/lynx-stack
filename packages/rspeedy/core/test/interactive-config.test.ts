// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs/promises'
import path from 'node:path'

import { logger } from '@rsbuild/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startInteractiveConfig } from '../src/utils/interactive-config.js'

// Import the mocked logger for assertions

// Mock fs methods
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue(true),
}))

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

// Mock logger
vi.mock('@rsbuild/core', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

interface Question {
  name: string
  default?: unknown
  type?: string
  choices?: string[]
}

// Mock inquirer with a custom implementation
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockImplementation((questions: Question[]) => {
      // Extract the name of the first question to determine what we're being asked for
      const firstQuestion = questions[0]!
      const name = firstQuestion.name

      // Return mock responses based on the question name
      return Promise.resolve({ [name]: firstQuestion.default })
    }),
  },
}))

describe('Interactive Configuration Tests', () => {
  const mockCwd = '/test/path'

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('startInteractiveConfig', () => {
    it('should check for inquirer dependency', async () => {
      const childProcess = await import('node:child_process')
      const execSyncMock = vi.mocked(childProcess.execSync)
      execSyncMock.mockImplementation(() => Buffer.from(''))

      await startInteractiveConfig(mockCwd)

      expect(execSyncMock).toHaveBeenCalledWith(
        expect.stringContaining('inquirer'),
        expect.anything(),
      )
    })

    it('should display installation instructions if inquirer is not installed', async () => {
      const childProcess = await import('node:child_process')
      const execSyncMock = vi.mocked(childProcess.execSync)
      execSyncMock.mockImplementation(() => {
        throw new Error('Not found')
      })

      await startInteractiveConfig(mockCwd)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('install inquirer'),
      )
    })

    it('should save configuration to a file when confirmed', async () => {
      const childProcess = await import('node:child_process')
      const execSyncMock = vi.mocked(childProcess.execSync)
      execSyncMock.mockImplementation(() => Buffer.from(''))

      await startInteractiveConfig(mockCwd)

      // Check that the file was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockCwd, 'lynx.config.js'),
        expect.stringContaining('development'),
        'utf-8',
      )

      // Check success message
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('successfully'),
      )
    })
  })
})
