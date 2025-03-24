// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { formatBytes } from '../src/utils/format-bytes.js'
import { displayPerformanceDashboard } from '../src/utils/performance-dashboard.js'

// Import the mocked logger

// Mock the logger
vi.mock('@rsbuild/core', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
  },
}))

describe('Performance Dashboard Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes')
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1024 * 1024)).toBe('1 MB')
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
    })

    it('should handle decimal precision', () => {
      expect(formatBytes(1500, 0)).toBe('1 KB')
      expect(formatBytes(1500, 2)).toBe('1.46 KB')
      expect(formatBytes(1500, 3)).toBe('1.465 KB')
    })
  })

  describe('displayPerformanceDashboard', () => {
    it('should display basic build metrics', () => {
      const metrics = {
        totalTime: 5000, // 5 seconds
        totalSize: 1024 * 1024, // 1 MB
        assets: [{ name: 'main.js', size: 512 * 1024, isInitial: true }],
        errors: 0,
        warnings: 0,
      }

      displayPerformanceDashboard(metrics)

      // Check that logger was called with expected information
      expect(logger.info).toHaveBeenCalled()

      // Flatten all calls to check content
      const infoContent = vi.mocked(logger.info).mock.calls.flat().join(' ')

      // Verify key information is displayed
      expect(infoContent).toContain('BUILD PERFORMANCE METRICS')
      expect(infoContent).toContain('5') // 5 seconds
      expect(infoContent).toContain('1 MB') // Total size
      expect(infoContent).toContain('main.js') // Asset name
    })

    it('should display success status when no errors/warnings', () => {
      const metrics = {
        totalTime: 3000,
        totalSize: 500000,
        assets: [],
        errors: 0,
        warnings: 0,
      }

      displayPerformanceDashboard(metrics)

      const infoContent = vi.mocked(logger.info).mock.calls.flat().join(' ')
      expect(infoContent).toContain('Success')
    })

    it('should sort assets by size (largest first)', () => {
      const metrics = {
        totalTime: 3000,
        totalSize: 1500000,
        assets: [
          { name: 'small.js', size: 10000, isInitial: false },
          { name: 'large.js', size: 500000, isInitial: true },
          { name: 'medium.js', size: 100000, isInitial: false },
        ],
        errors: 0,
        warnings: 0,
      }

      displayPerformanceDashboard(metrics)

      const calls = vi.mocked(logger.info).mock.calls

      // Find asset lines
      const assetLines = calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('.js')
      ).map(call => call[0]) as string[]

      // Check that large.js appears before medium.js and medium.js before small.js
      const largeIndex = assetLines.findIndex(line => line.includes('large.js'))
      const mediumIndex = assetLines.findIndex(line =>
        line.includes('medium.js')
      )
      const smallIndex = assetLines.findIndex(line => line.includes('small.js'))

      expect(largeIndex).toBeLessThan(mediumIndex)
      expect(mediumIndex).toBeLessThan(smallIndex)
    })

    it('should provide optimization recommendations for large bundles', () => {
      const metrics = {
        totalTime: 15000, // 15 seconds (slow)
        totalSize: 3 * 1024 * 1024, // 3 MB (large)
        assets: [
          { name: 'huge.js', size: 1024 * 1024, isInitial: true }, // 1 MB initial bundle (large)
        ],
        errors: 0,
        warnings: 0,
      }

      displayPerformanceDashboard(metrics)

      const infoContent = vi.mocked(logger.info).mock.calls.flat().join(' ')

      // Should contain optimization recommendations
      expect(infoContent).toContain('Optimization Recommendations')
      expect(infoContent).toContain('code splitting')
      expect(infoContent).toContain('Build time is high')
      expect(infoContent).toContain('bundle size is large')
    })
  })
})
