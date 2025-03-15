// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test, vi } from 'vitest'

import { LAYERS } from '@lynx-js/react-webpack-plugin'
import { createRspeedy } from '@lynx-js/rspeedy'

vi
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

describe('Config', () => {
  test('background-only alias', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()
    if (!config?.module?.rules) {
      expect.fail('should have config.module.rules')
    }

    const backgroundAlias = config.module.rules.find((rule) => {
      if (!rule || typeof rule !== 'object') {
        return false
      }
      if (rule.issuerLayer === LAYERS.BACKGROUND && rule.resolve?.alias) {
        const alias = rule.resolve.alias
        if (
          Object.prototype.hasOwnProperty.call(alias, 'background-only$')
          && typeof alias['background-only$'] === 'string'
          && alias['background-only$'].includes('background-only/empty.js')
        ) {
          return true
        }
      }
      return false
    })

    const mainThreadAlias = config.module.rules.find((rule) => {
      if (!rule || typeof rule !== 'object') {
        return false
      }
      if (rule.issuerLayer === LAYERS.MAIN_THREAD && rule.resolve?.alias) {
        const alias = rule.resolve.alias
        if (
          Object.prototype.hasOwnProperty.call(alias, 'background-only$')
          && typeof alias['background-only$'] === 'string'
          && alias['background-only$'].includes('background-only/error.js')
        ) {
          return true
        }
      }
      return false
    })

    if (!backgroundAlias || !mainThreadAlias) {
      expect.fail('background-only alias fail')
    }
  })

  test('background-only rules', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()
    if (!config?.module?.rules) {
      expect.fail('should have config.module.rules')
    }

    const rule = config.module.rules.find(rule => {
      if (!rule || typeof rule !== 'object' || typeof rule.test !== 'string') {
        return false
      }
      return rule.test?.toString().includes(
        path.join('background-only', 'error.js'),
      )
    })

    if (!rule || typeof rule !== 'object') {
      expect.fail('should have background-only rules')
    }

    expect(rule.issuerLayer).toBe(LAYERS.MAIN_THREAD)

    if (Array.isArray(rule.use)) {
      const useEntry = rule.use.find(item => {
        if (typeof item === 'string') {
          return item.includes('invalid-import-error-loader')
        } else {
          return item.loader.includes('invalid-import-error-loader')
            && typeof item.options === 'object'
            && Object.prototype.hasOwnProperty.call(item.options, 'message')
            && item.options['message']
              === '\'background-only\' cannot be imported from a main-thread module.'
        }
      })

      if (!useEntry) {
        expect.fail('should have background-only rules')
      }
    } else if (typeof rule.use === 'string') {
      expect(rule.use.includes('invalid-import-error-loader')).toBe(true)
    } else if (typeof rule.use === 'object') {
      expect(rule.use.loader.includes('invalid-import-error-loader')).toBe(true)
    }
  })
})

describe('Build background-only', () => {
  test('build fail', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          tsconfigPath: new URL('./tsconfig.json', import.meta.url).pathname,
          entry: {
            main:
              new URL('./fixtures/background-only/fail.tsx', import.meta.url)
                .pathname,
          },
        },
        tools: {
          swc(config) {
            delete config.env
            return config
          },
          rspack: {
            output: {
              chunkFormat: 'commonjs',
            },
            context: path.dirname(fileURLToPath(import.meta.url)),
            resolve: {
              extensionAlias: {
                '.js': ['.ts', '.js'],
                '.jsx': ['.tsx', '.jsx'],
              },
            },
          },
        },
        environments: {
          lynx: {},
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    try {
      await rsbuild.build()
    } catch (error) {
      expect((error as Error).message).toBe(
        'Rspack build failed.',
      )
    }
  })

  test('build success', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          tsconfigPath: new URL('./tsconfig.json', import.meta.url).pathname,
          entry: {
            main:
              new URL('./fixtures/background-only/success.tsx', import.meta.url)
                .pathname,
          },
        },
        tools: {
          swc(config) {
            delete config.env
            return config
          },
          rspack: {
            output: {
              chunkFormat: 'commonjs',
            },
            context: path.dirname(fileURLToPath(import.meta.url)),
            resolve: {
              extensionAlias: {
                '.js': ['.ts', '.js'],
                '.jsx': ['.tsx', '.jsx'],
              },
            },
          },
        },
        environments: {
          lynx: {},
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    try {
      await rsbuild.build()
    } catch (_error) {
      expect.fail('build should succeed')
    }
  })
})
