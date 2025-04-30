// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import type { Rspack } from '@rsbuild/core'
import { describe, expect, test, vi } from 'vitest'

import { createRspeedy } from '@lynx-js/rspeedy'

import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

describe('Lazy', () => {
  test('alias for react', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactLynx({
            experimental_isLazyBundle: true,
          }),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(config?.resolve?.alias).not.toHaveProperty(
      '@lynx-js/react',
    )
    expect(config?.resolve?.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining('lazy/react'),
    )
    expect(config?.resolve?.alias).not.toHaveProperty(
      'react',
    )
    expect(config?.resolve?.alias).toHaveProperty(
      'react$',
      expect.stringContaining('lazy/react'),
    )

    expect(config?.resolve?.alias).not.toHaveProperty(
      '@lynx-js/react/internal',
    )
    expect(config?.resolve?.alias).toHaveProperty(
      '@lynx-js/react/internal$',
      expect.stringContaining('lazy/internal'),
    )
  })

  test('output.library', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactLynx({
            experimental_isLazyBundle: true,
          }),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(config?.output?.library).toHaveProperty('type', 'commonjs')
  })
  ;['development', 'production'].forEach(mode => {
    test(`exports should have the component exported on ${mode} mode`, async () => {
      vi.stubEnv('NODE_ENV', mode)

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      let backgroundJSContent = ''

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: new URL(
                './fixtures/standalone-lazy-bundle/index.tsx',
                import.meta.url,
              )
                .pathname,
            },
          },
          output: {
            distPath: {
              root: new URL(
                './dist/standalone-lazy-bundle',
                import.meta.url,
              ).pathname,
            },
          },
          plugins: [
            pluginReactLynx({
              experimental_isLazyBundle: true,
            }),
          ],
          tools: {
            rspack: {
              plugins: [
                {
                  name: 'extractBackgroundJSContent',
                  apply(compiler) {
                    compiler.hooks.compilation.tap(
                      'extractBackgroundJSContent',
                      (compilation) => {
                        compilation.hooks.processAssets.tap(
                          'extractBackgroundJSContent',
                          (assets) => {
                            for (const key in assets) {
                              if (/background.*?\.js$/.test(key)) {
                                backgroundJSContent = assets[key]!.source()
                                  .toString()!
                              }
                            }
                          },
                        )
                      },
                    )
                  },
                } as Rspack.RspackPluginInstance,
              ],
            },
          },
        },
      })

      await rsbuild.build()

      const handler = {
        get: function() {
          return new Proxy(() => infiniteNestedObject, handler)
        },
      }
      const infiniteNestedObject = new Proxy(
        () => infiniteNestedObject,
        handler,
      )

      // biome-ignore lint/suspicious/noExplicitAny: cache of modules
      const mod: Record<string, any> = {}
      // biome-ignore lint/suspicious/noExplicitAny: used to collect exports from lazy bundle
      const exports: Record<string, any> = {}
      // @ts-expect-error tt is used in eval of backgroundJSContent
      // biome-ignore lint/correctness/noUnusedVariables: tt is used in eval of backgroundJSContent
      const tt = {
        define: (key: string, func: () => void) => {
          mod[key] = func
        },
        require: (key: string) => {
          // biome-ignore lint/suspicious/noExplicitAny: args passed to tt.define of lazy bundle
          const args: any[] = Array(18).fill(0).map(() => infiniteNestedObject)
          args[2] = exports
          args[10] = console
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return mod[key](
            ...args,
          )
        },
      }
      eval(backgroundJSContent)

      expect(exports).toHaveProperty(
        'default',
      )
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(exports['default'].name).toBe('LazyBundleComp')

      vi.unstubAllEnvs()
    })
  })
})
