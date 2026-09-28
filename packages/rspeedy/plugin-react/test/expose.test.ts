// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'
import type { ReactCompileResultExposureV1 } from '../src/compileResult.js'
import type { LynxTemplatePlugin, TemplateHooks } from '../src/index.js'

const REACT_COMPILE_RESULT_EXPOSURE = Symbol.for(
  '@lynx-js/react/internal:compile-result',
)

describe('Expose', () => {
  test.each(
    [
      ['fixtures/main-thread-programmability.tsx', true],
      ['fixtures/lazy-main-thread-programmability/index.tsx', true],
      ['fixtures/basic.tsx', false],
    ] as const,
  )(
    'reports final runtime requirements for %s',
    async (fixture, mainThreadProgrammability) => {
      let exposure: ReactCompileResultExposureV1 | undefined
      const { pluginReactLynx } = await import('../src/index.js')
      const consumeReactCompileResult: RsbuildPlugin = {
        name: 'consume-react-compile-result',
        setup(api) {
          exposure = api.useExposed<ReactCompileResultExposureV1>(
            REACT_COMPILE_RESULT_EXPOSURE,
          )
        },
      }
      const tmp = await mkdtemp(
        path.join(tmpdir(), 'rspeedy-react-test-compile-result-'),
      )
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: fileURLToPath(new URL(fixture, import.meta.url)),
            },
          },
          output: { distPath: { root: tmp } },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
            consumeReactCompileResult,
          ],
        },
      })

      const result = await rsbuild.build()
      try {
        expect(exposure?.version).toBe(1)
        expect(result.stats).toBeDefined()
        expect(exposure?.getCompileResult(result.stats!)).toEqual({
          version: 1,
          runtimeRequirements: { mainThreadProgrammability },
        })
      } finally {
        await result.close()
      }
    },
  )

  test('LynxTemplatePlugin', async () => {
    const { pluginReactLynx } = await import('../src/index.js')

    let expose: { LynxTemplatePlugin: LynxTemplatePlugin } | undefined
    let beforeEncodeArgs:
      | Parameters<Parameters<TemplateHooks['beforeEncode']['tap']>[1]>[0]
      | undefined

    const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-react-test-expose-'))

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: fileURLToPath(
              new URL('./fixtures/basic.tsx', import.meta.url),
            ),
          },
        },
        output: {
          // Isolate the dist root so this build cannot race other tests in
          // this package writing to the default `test/dist/` directory.
          distPath: { root: tmp },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
          {
            name: 'pluginThatUsesTemplateHooks',
            setup(api) {
              api.modifyBundlerChain(chain => {
                // `pluginLynx` exposes this, and Rspeedy applies the engine
                // after the user plugins, so it is read in a hook rather than
                // in `setup`.
                expose = api.useExposed<
                  { LynxTemplatePlugin: LynxTemplatePlugin }
                >(Symbol.for('LynxTemplatePlugin'))
                const PLUGIN_NAME = 'pluginThatUsesTemplateHooks'
                chain.plugin(PLUGIN_NAME).use({
                  apply(compiler) {
                    compiler.hooks.compilation.tap(
                      PLUGIN_NAME,
                      compilation => {
                        const templateHooks = expose!.LynxTemplatePlugin
                          .getLynxTemplatePluginHooks(
                            compilation as unknown as Parameters<
                              LynxTemplatePlugin['getLynxTemplatePluginHooks']
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
        "/.lynx/main/background.js",
      ]
    `)
  })
})
