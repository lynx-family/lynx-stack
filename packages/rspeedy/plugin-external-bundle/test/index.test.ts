// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRsbuild } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin'

import { pluginStubLayers } from './stub-layers.plugin.js'

describe('pluginExternalBundle', () => {
  test('should register ExternalsLoadingPlugin with correct options', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const externalsConfig = {
      lodash: {
        url: 'http://lodash.lynx.bundle',
        background: { sectionPath: 'background' },
        mainThread: { sectionPath: 'mainThread' },
      },
      react: {
        url: 'http://react.lynx.bundle',
        background: { sectionPath: 'react-background' },
        mainThread: { sectionPath: 'react-main' },
      },
    }

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            // Capture plugins for verification
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externals: externalsConfig,
          }),
        ],
      },
    })

    // Trigger the config to be resolved
    await rsbuild.inspectConfig()

    // Verify that ExternalsLoadingPlugin is registered
    const externalBundlePlugin = capturedPlugins.find(
      (plugin) => plugin instanceof ExternalsLoadingPlugin,
    )

    expect(externalBundlePlugin).toBeDefined()

    // Verify plugin options
    expect(externalBundlePlugin).toMatchObject({
      options: {
        backgroundLayer: 'BACKGROUND_LAYER',
        mainThreadLayer: 'MAIN_THREAD_LAYER',
        externals: externalsConfig,
      },
    })
  })

  test('should throw error if LAYERS is not exposed', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        plugins: [
          // Not including pluginStubLayers to test error case
          pluginExternalBundle({
            externals: {
              lodash: {
                url: 'http://lodash.lynx.bundle',
                background: { sectionPath: 'background' },
                mainThread: { sectionPath: 'mainThread' },
              },
            },
          }),
        ],
      },
    })

    // The error should be thrown during config inspection/build
    await expect(rsbuild.inspectConfig()).rejects.toThrow(
      'external-bundle-rsbuild-plugin requires exposed `LAYERS`.',
    )
  })

  test('should work with empty externals config', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [pluginStubLayers(), pluginExternalBundle({ externals: {} })],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = capturedPlugins.find(
      (plugin) => plugin instanceof ExternalsLoadingPlugin,
    )

    expect(externalBundlePlugin).toBeDefined()
    expect(externalBundlePlugin).toMatchObject({
      options: {
        externals: {},
      },
    })
  })

  test('should correctly pass layer names from LAYERS', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const customLayers = {
      BACKGROUND: 'CUSTOM_BACKGROUND',
      MAIN_THREAD: 'CUSTOM_MAIN',
    }

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(customLayers),
          pluginExternalBundle({
            externals: {
              lodash: {
                url: 'http://lodash.lynx.bundle',
                background: { sectionPath: 'background' },
                mainThread: { sectionPath: 'mainThread' },
              },
            },
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = capturedPlugins.find(
      (plugin) => plugin instanceof ExternalsLoadingPlugin,
    )

    expect(externalBundlePlugin).toBeDefined()
    expect(externalBundlePlugin).toMatchObject({
      options: {
        backgroundLayer: 'CUSTOM_BACKGROUND',
        mainThreadLayer: 'CUSTOM_MAIN',
      },
    })
  })
})
