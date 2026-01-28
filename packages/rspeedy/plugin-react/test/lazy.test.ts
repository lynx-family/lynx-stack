// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import path from 'node:path'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, test, vi } from 'vitest'

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

describe('Lazy', () => {
  test('alias for react', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
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
      expect.stringContaining('lazy/react'.replaceAll('/', path.sep)),
    )
    expect(config?.resolve?.alias).not.toHaveProperty(
      'react',
    )
    expect(config?.resolve?.alias).toHaveProperty(
      'react$',
      expect.stringContaining('lazy/react'.replaceAll('/', path.sep)),
    )

    expect(config?.resolve?.alias).not.toHaveProperty(
      '@lynx-js/react/internal',
    )
    expect(config?.resolve?.alias).toHaveProperty(
      '@lynx-js/react/internal$',
      expect.stringContaining('lazy/internal'.replaceAll('/', path.sep)),
    )
  })

  test('output.library', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
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
              root: './dist/standalone-lazy-bundle',
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

  test('lazy bundle beforeEncode entryNames', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const entryNamesOfBeforeEncode: string[][] = []
    let backgroundJSContent = ''

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: new URL(
              './fixtures/lazy-bundle/index.tsx',
              import.meta.url,
            ).pathname,
          },
        },
        output: {
          distPath: {
            root: './dist/lazy-bundle',
          },
        },
        plugins: [
          pluginReactLynx(),
          {
            name: 'test',
            pre: ['lynx:react'],
            setup(api) {
              api.modifyBundlerChain((chain, { CHAIN_ID }) => {
                const rule = chain.module
                  .rules.get('css:react:main-thread')
                  .uses.get(CHAIN_ID.USE.IGNORE_CSS)
                rule.loader(
                  // add .ts suffix to ignore-css-loader
                  // this workaround is needed because vitest
                  // runs on our ts files.
                  rule.get('loader') as string + '.ts',
                )
              })
            },
          } as RsbuildPlugin,
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
                            if (/[\\/]background.js$/.test(key)) {
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
              {
                name: 'beforeEncode-test',
                apply(compiler) {
                  compiler.hooks.compilation.tap(
                    'beforeEncode-test',
                    (compilation) => {
                      const hooks = LynxTemplatePlugin
                        .getLynxTemplatePluginHooks(
                          compilation as unknown as Parameters<
                            typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
                          >[0],
                        )
                      hooks.beforeEncode.tap(
                        'beforeEncode-test',
                        (args) => {
                          entryNamesOfBeforeEncode.push(args.entryNames)

                          return args
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

    expect(entryNamesOfBeforeEncode).toMatchInlineSnapshot(`
      [
        [
          "main__main-thread",
          "main",
        ],
        [
          "./LazyComponent.js-react__main-thread",
          "./LazyComponent.js-react__background",
        ],
      ]
    `)
    const cssHotUpdateList = /\.cssHotUpdateList\s*=\s*(\[\[[\s\S]*?\]\])/.exec(
      backgroundJSContent,
    )![1]
    expect(cssHotUpdateList).toMatchInlineSnapshot(
      `"[["./LazyComponent.js-react__background",".rspeedy/async/./LazyComponent.js-react__background/./LazyComponent.js-react__background.css.hot-update.json"],["main",".rspeedy/main/main.css.hot-update.json"]]"`,
    )
  })

  test('lazy bundle app-service.js should not load hot-update.js', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    let appServiceJSContent = ''
    let done = false
    const waitCompilationDone = () =>
      new Promise(resolve => {
        const interval = setInterval(() => {
          if (done) {
            clearInterval(interval)
            done = false
            resolve(null)
          }
        }, 100)
      })

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: new URL(
              './fixtures/lazy-bundle/index.tsx',
              import.meta.url,
            ).pathname,
          },
        },
        output: {
          distPath: {
            root: './dist/lazy-bundle',
          },
        },
        plugins: [
          pluginReactLynx(),
          {
            name: 'test',
            pre: ['lynx:react'],
            setup(api) {
              api.modifyBundlerChain((chain, { CHAIN_ID }) => {
                const rule = chain.module
                  .rules.get('css:react:main-thread')
                  .uses.get(CHAIN_ID.USE.IGNORE_CSS)
                rule.loader(
                  // add .ts suffix to ignore-css-loader
                  // this workaround is needed because vitest
                  // runs on our ts files.
                  rule.get('loader') as string + '.ts',
                )
              })
            },
          } as RsbuildPlugin,
        ],
        tools: {
          rspack: {
            plugins: [
              {
                name: 'beforeEncode-test',
                apply(compiler) {
                  compiler.hooks.compilation.tap(
                    'beforeEncode-test',
                    (compilation) => {
                      const hooks = LynxTemplatePlugin
                        .getLynxTemplatePluginHooks(
                          compilation as unknown as Parameters<
                            typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
                          >[0],
                        )
                      hooks.beforeEmit.tap(
                        'beforeEmit-test',
                        (args) => {
                          if (
                            args.entryNames.some((name) =>
                              name.includes('LazyComponent')
                            )
                          ) {
                            appServiceJSContent = args.finalEncodeOptions
                              .manifest['/app-service.js']!
                          }
                          return args
                        },
                      )
                    },
                  )
                  compiler.hooks.done.tap('beforeEncode-test', () => {
                    done = true
                  })
                },
              } as Rspack.RspackPluginInstance,
            ],
          },
        },
      },
    })

    await rsbuild.createDevServer()
    await waitCompilationDone()
    expect(appServiceJSContent).toMatchInlineSnapshot(
      `"(function(){'use strict';function n({tt}){tt.define('/app-service.js',function(e,module,_,i,l,u,a,c,s,f,p,d,h,v,g,y,lynx){module.exports=lynx.requireModule("/static/js/async/./LazyComponent.js-react__background.js",globDynamicComponentEntry?globDynamicComponentEntry:'__Card__');});return tt.require('/app-service.js');}return{init:n}})()"`,
    )

    // Modify the fixtures/lazy-bundle/LazyComponent.tsx file
    // to trigger HMR
    const tmpContent = await fs.readFile(
      new URL('./fixtures/lazy-bundle/LazyComponent.tsx', import.meta.url),
      'utf-8',
    )
    await fs.writeFile(
      new URL('./fixtures/lazy-bundle/LazyComponent.tsx', import.meta.url),
      'export default function LazyComponent() { return null }',
    )
    await waitCompilationDone()

    expect(appServiceJSContent).toMatchInlineSnapshot(
      `"(function(){'use strict';function n({tt}){tt.define('/app-service.js',function(e,module,_,i,l,u,a,c,s,f,p,d,h,v,g,y,lynx){module.exports=lynx.requireModule("/static/js/async/./LazyComponent.js-react__background.js",globDynamicComponentEntry?globDynamicComponentEntry:'__Card__');});return tt.require('/app-service.js');}return{init:n}})()"`,
    )

    // Restore the original content
    await fs.writeFile(
      new URL('./fixtures/lazy-bundle/LazyComponent.tsx', import.meta.url),
      tmpContent,
    )
  })
})
