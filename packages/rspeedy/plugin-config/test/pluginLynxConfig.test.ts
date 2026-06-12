// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable no-irregular-whitespace */
import { describe, expect, rstest, test } from '@rstest/core'

import { createRspeedy } from '@lynx-js/rspeedy'
import type { RsbuildPluginAPI } from '@lynx-js/rspeedy'
import { compilerOptionsKeys, configKeys } from '@lynx-js/type-config'

rstest.mock('../src/LynxConfigWebpackPlugin.js', { mock: true })
describe('pluginLynxConfig', () => {
  test('should throw error when no LynxTemplatePlugin exposed', async () => {
    const { pluginLynxConfig } = await import('../src/pluginLynxConfig.js')

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginLynxConfig({}),
        ],
      },
    })

    await expect(() => rspeedy.initConfigs()).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [Error: [pluginLynxConfig] No \`LynxTemplatePlugin\` exposed to the plugin API (​https://rsbuild.rs/plugins/dev/core#apiexpose​).

      Please upgrade Rspeedy and plugins to latest version.

      See Upgrade Rspeedy (​https://www.npmjs.com/package/upgrade-rspeedy​) for more details.
      ]
    `)
  })

  test('should throw error when lynx:react plugin exists', async () => {
    const { pluginLynxConfig } = await import('../src/pluginLynxConfig.js')

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginLynxConfig({}),
          {
            name: 'lynx:react',
            setup: rstest.fn(),
          },
        ],
      },
    })

    await expect(() => rspeedy.initConfigs()).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [Error: [pluginLynxConfig] No \`LynxTemplatePlugin\` exposed to the plugin API (​https://rsbuild.rs/plugins/dev/core#apiexpose​).

      Please upgrade @lynx-js/react-rsbuild-plugin to latest version.

      See Upgrade Rspeedy (​https://www.npmjs.com/package/upgrade-rspeedy​) for more details.
      ]
    `)
  })

  test('should throw error when lynx:vue plugin exists', async () => {
    const { pluginLynxConfig } = await import('../src/pluginLynxConfig.js')

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginLynxConfig({}, {
            dslPluginName2PkgName: {
              'lynx:vue': '@lynx-js/vue-rsbuild-plugin',
            },
          }),
          {
            name: 'lynx:vue',
            setup: rstest.fn(),
          },
        ],
      },
    })

    await expect(() => rspeedy.initConfigs()).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [Error: [pluginLynxConfig] No \`LynxTemplatePlugin\` exposed to the plugin API (​https://rsbuild.rs/plugins/dev/core#apiexpose​).

      Please upgrade @lynx-js/vue-rsbuild-plugin to latest version.

      See Upgrade Rspeedy (​https://www.npmjs.com/package/upgrade-rspeedy​) for more details.
      ]
    `)
  })

  test('should have LynxTemplatePlugin passed to LynxConfigWebpackPlugin', async () => {
    const { LynxConfigWebpackPlugin } = await import(
      '../src/LynxConfigWebpackPlugin.js'
    )
    const { pluginLynxConfig } = await import('../src/pluginLynxConfig.js')

    const LynxTemplatePlugin = rstest.fn()

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginLynxConfig({ enableAccessibilityElement: true }),
          {
            name: 'test',
            setup(api: RsbuildPluginAPI) {
              api.expose(Symbol.for('LynxTemplatePlugin'), {
                LynxTemplatePlugin,
              })
            },
          },
        ],
      },
    })

    await rspeedy.initConfigs()

    expect(LynxConfigWebpackPlugin).toHaveBeenCalledWith(
      {
        LynxTemplatePlugin,
        config: {
          enableAccessibilityElement: true,
        },
        compilerOptionsKeys,
        configKeys,
      },
    )
  })
})
