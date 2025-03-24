// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { logger } from '@rsbuild/core'
import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { build } from '../src/cli/build.js'
// eslint-disable-next-line import/order
import { dev } from '../src/cli/dev.js'

// Import the mocked functions for assertion
import { exit } from '../src/cli/exit.js'
import { createRspeedy } from '../src/create-rspeedy.js'

// Mock exit function to prevent tests from exiting
vi.mock('../src/cli/exit.js', () => ({
  exit: vi.fn(),
}))

// Mock logger
vi.mock('@rsbuild/core', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock createRspeedy
vi.mock('../src/create-rspeedy.js', () => ({
  createRspeedy: vi.fn(() => ({
    build: vi.fn().mockResolvedValue({
      isSuccessful: true,
      stats: {
        assets: [
          { name: 'main.js', size: 1024 * 100, chunkNames: ['main'] },
        ],
        errors: [],
        warnings: [],
      },
    }),
    startDevServer: vi.fn().mockResolvedValue({
      urls: ['http://localhost:3000'],
      restart: vi.fn(),
    }),
  })),
}))

// Helper to get the current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mockCwd = path.resolve(__dirname, '../')

interface DevServerOptions {
  port?: number
  host?: string
  https?: boolean
  open?: boolean
}

interface RspeedyInstance {
  startDevServer: (options: DevServerOptions) => Promise<void>
}

describe('CLI Integration Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('build command', () => {
    it('should add dashboard option to the command', async () => {
      const command = new Command()
      const addOptionSpy = vi.spyOn(command, 'option')

      await build.call(command, mockCwd, {})

      // Check that the dashboard option was added
      expect(addOptionSpy).toHaveBeenCalledWith(
        '--dashboard',
        expect.stringContaining('performance metrics'),
      )
    })

    it('should display success message on successful build', async () => {
      await build.call(new Command(), mockCwd, {})

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Build complete'),
      )
      expect(exit).toHaveBeenCalledWith(0)
    })

    it('should show performance dashboard when enabled', async () => {
      await build.call(new Command(), mockCwd, { dashboard: true })

      // Verify dashboard was displayed
      const infoContent = vi.mocked(logger.info).mock.calls.flat().join(' ')
      expect(infoContent).toContain('BUILD PERFORMANCE METRICS')
    })
  })

  describe('dev command', () => {
    it('should add port, host, open, and https options', async () => {
      const command = new Command()
      const addOptionSpy = vi.spyOn(command, 'option')

      await dev.call(command, mockCwd, {})

      // Check that the CLI options were added
      expect(addOptionSpy).toHaveBeenCalledWith(
        '--port <port>',
        expect.stringContaining('port'),
        expect.any(Function),
      )
      expect(addOptionSpy).toHaveBeenCalledWith(
        '--host <host>',
        expect.stringContaining('host'),
      )
      expect(addOptionSpy).toHaveBeenCalledWith(
        '--open',
        expect.stringContaining('browser'),
      )
      expect(addOptionSpy).toHaveBeenCalledWith(
        '--https',
        expect.stringContaining('HTTPS'),
      )
    })

    it('should display server URLs when available', async () => {
      await dev.call(new Command(), mockCwd, {})

      // Check that URLs are displayed
      const infoContent = vi.mocked(logger.info).mock.calls.flat().join(' ')
      expect(infoContent).toContain('http://localhost:3000')
      expect(infoContent).toContain('Development server is running')
    })

    it('should pass user options to the dev server', async () => {
      const options = {
        port: 4000,
        host: '0.0.0.0',
        open: true,
        https: true,
      }

      await dev.call(new Command(), mockCwd, options)

      // Check that createRspeedy was called with the correct options
      expect(createRspeedy).toHaveBeenCalledWith(expect.objectContaining({
        cwd: mockCwd,
      }))

      // Check startDevServer was called with user options
      const createRspeedyResult = await vi.mocked(createRspeedy).mock.results[0]
        ?.value as RspeedyInstance
      if (createRspeedyResult) {
        expect(createRspeedyResult.startDevServer).toHaveBeenCalledWith(
          expect.objectContaining({
            port: 4000,
            host: '0.0.0.0',
            open: true,
            https: true,
          }),
        )
      }
    })
  })
})
