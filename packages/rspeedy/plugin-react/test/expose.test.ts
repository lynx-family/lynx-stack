// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { createRspeedy } from '@lynx-js/rspeedy'

import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'
import type { LynxTemplatePlugin, TemplateHooks } from '../src/index.js'

describe('Expose', () => {
  test('LynxTemplatePlugin', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    let expose: { LynxTemplatePlugin: typeof LynxTemplatePlugin } | undefined
    let beforeEncodeArgs:
      | Parameters<Parameters<TemplateHooks['beforeEncode']['tap']>[1]>[0]
      | undefined

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: new URL('./fixtures/basic.tsx', import.meta.url).pathname,
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
          {
            name: 'pluginThatUsesTemplateHooks',
            setup(api) {
              expose = api.useExposed<
                { LynxTemplatePlugin: typeof LynxTemplatePlugin }
              >(Symbol.for('LynxTemplatePlugin'))
              api.modifyBundlerChain(chain => {
                const PLUGIN_NAME = 'pluginThatUsesTemplateHooks'
                chain.plugin(PLUGIN_NAME).use({
                  apply(compiler) {
                    compiler.hooks.compilation.tap(
                      PLUGIN_NAME,
                      compilation => {
                        const templateHooks = expose!.LynxTemplatePlugin
                          .getLynxTemplatePluginHooks(
                            compilation as unknown as Parameters<
                              typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
                            >[0],
                          )
                        templateHooks.beforeEncode.tap(PLUGIN_NAME, args => {
                          beforeEncodeArgs = args
                          return args
                        })
                      },
                    )
                  },
                } as Rspack.RspackPluginInstance)
              })
            },
          } as RsbuildPlugin,
        ],
      },
    })

    expect(expose).toBeUndefined()
    expect(beforeEncodeArgs).toBeUndefined()

    await rsbuild.initConfigs()
    expect(expose).toMatchInlineSnapshot(`
      {
        "LynxTemplatePlugin": [Function],
      }
    `)

    await rsbuild.build()

    expect(Object.keys(beforeEncodeArgs!.encodeData.lepusCode))
      .toMatchInlineSnapshot(`
      [
        "root",
        "chunks",
        "filename",
      ]
    `)
    expect(Object.keys(beforeEncodeArgs!.encodeData.manifest))
      .toMatchInlineSnapshot(`
      [
        "/app-service.js",
        "/.rspeedy/main/background.js",
      ]
    `)
  })
})
