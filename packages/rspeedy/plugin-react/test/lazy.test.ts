// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

// Workaround for an upstream `@rstest/coverage-istanbul` bug: it injects the
// coverage SWC plugin by `push`-ing onto a shallow-copied (hence shared)
// `jsc.experimental.plugins` array, so under `--coverage` the instrumentation
// can leak into the nested `rsbuild.build()` calls below. The emitted bundle
// then carries istanbul `cov_*` counters whose declarations are not part of the
// eval'd slice, so `eval()` throws `cov_* is not defined`. Stub any leaked
// counter with a coercion-safe no-op (so `cov_*().s[0]++` etc. don't throw)
// while evaluating, then restore. Drop once the upstream fix (clone before
// mutate) is released.
function withLeakedCoverageCountersStubbed<T>(
  code: string,
  run: () => T,
): T {
  type CoverageCounterSink = () => CoverageCounterSink
  const sink: CoverageCounterSink = new Proxy(
    function sinkTarget() {/* unreachable: the `apply` trap handles calls */},
    {
      get: (_target, prop) => (prop === Symbol.toPrimitive ? () => 0 : sink),
      apply: () => sink,
      set: () => true,
    },
  ) as unknown as CoverageCounterSink
  const added: string[] = []
  for (const name of new Set(code.match(/\bcov_\d+\b/g) ?? [])) {
    if (!(name in globalThis)) {
      ;(globalThis as Record<string, unknown>)[name] = () => sink
      added.push(name)
    }
  }
  try {
    return run()
  } finally {
    for (const name of added) {
      delete (globalThis as Record<string, unknown>)[name]
    }
  }
}

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
      rstest.stubEnv('NODE_ENV', mode)

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      let backgroundJSContent = ''

      // Isolate the dist root so this build cannot race other tests in this
      // package writing to the default `test/dist/` directory.
      const tmp = await fs.mkdtemp(
        path.join(tmpdir(), 'rspeedy-react-test-lazy-standalone-'),
      )

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: fileURLToPath(
                new URL(
                  './fixtures/standalone-lazy-bundle/index.tsx',
                  import.meta.url,
                ),
              ),
            },
          },
          output: {
            distPath: {
              root: tmp,
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
      withLeakedCoverageCountersStubbed(backgroundJSContent, () => {
        eval(backgroundJSContent)
      })

      expect(exports).toHaveProperty(
        'default',
      )
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(exports['default'].name).toBe('LazyBundleComp')

      rstest.unstubAllEnvs()
    })
  })

  test('lazy bundle beforeEncode entryNames', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const entryNamesOfBeforeEncode: string[][] = []
    let backgroundJSContent = ''

    // Isolate the dist root so this build cannot race other tests in this
    // package writing to the default `test/dist/` directory.
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-lazy-bundle-'),
    )

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: fileURLToPath(
              new URL(
                './fixtures/lazy-bundle/index.tsx',
                import.meta.url,
              ),
            ),
          },
        },
        output: {
          distPath: {
            root: tmp,
          },
        },
        performance: {
          profile: true,
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

    try {
      await rsbuild.build()

      expect(entryNamesOfBeforeEncode).toMatchInlineSnapshot(`
        [
          [
            "main__main-thread",
            "main",
          ],
          [
            "./LazyComponent.js-react__background",
            "./LazyComponent.js-react__main-thread",
          ],
        ]
      `)
      const cssHotUpdateList =
        /\.cssHotUpdateList\s*=\s*(\[\[[\s\S]*?\]\])/.exec(
          backgroundJSContent,
        )![1]
      expect(cssHotUpdateList).toMatchInlineSnapshot(
        `"[["./LazyComponent.js-react__background",".rspeedy/async/./LazyComponent.js-react__background/./LazyComponent.js-react__background.css.hot-update.json"],["main",".rspeedy/main/main.css.hot-update.json"]]"`,
      )
    } finally {
      rstest.unstubAllEnvs()
    }
  })

  test('lazy bundle app-service.js should not load hot-update.js', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
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
            main: fileURLToPath(
              new URL(
                './fixtures/lazy-bundle/index.tsx',
                import.meta.url,
              ),
            ),
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

    const lazyComponentUrl = new URL(
      './fixtures/lazy-bundle/LazyComponent.tsx',
      import.meta.url,
    )
    let tmpContent: string | undefined

    try {
      await rsbuild.createDevServer()
      await waitCompilationDone()
      expect(appServiceJSContent).toMatchInlineSnapshot(
        `"(function(){'use strict';function n({tt}){tt.define('/app-service.js',function(e,module,_,i,l,u,a,c,s,f,p,d,h,v,g,y,lynx){module.exports=lynx.requireModule("/static/js/async/./LazyComponent.js-react__background.js",globDynamicComponentEntry?globDynamicComponentEntry:'__Card__');});return tt.require('/app-service.js');}return{init:n}})()"`,
      )

      // Modify the fixtures/lazy-bundle/LazyComponent.tsx file
      // to trigger HMR
      tmpContent = await fs.readFile(lazyComponentUrl, 'utf-8')
      await fs.writeFile(
        lazyComponentUrl,
        'export default function LazyComponent() { return null }',
      )
      await waitCompilationDone()

      expect(appServiceJSContent).toMatchInlineSnapshot(
        `"(function(){'use strict';function n({tt}){tt.define('/app-service.js',function(e,module,_,i,l,u,a,c,s,f,p,d,h,v,g,y,lynx){module.exports=lynx.requireModule("/static/js/async/./LazyComponent.js-react__background.js",globDynamicComponentEntry?globDynamicComponentEntry:'__Card__');});return tt.require('/app-service.js');}return{init:n}})()"`,
      )
    } finally {
      if (tmpContent !== undefined) {
        await fs.writeFile(lazyComponentUrl, tmpContent)
      }
      rstest.unstubAllEnvs()
    }
  })

  // Regression test for a lazy bundle whose background (bts) was externalized
  // via `lynx.requireModuleAsync` and therefore unavailable when the bundle is
  // required synchronously (the module is empty at `installChunk` time and
  // loading crashes). This reproduces the production setup: `inlineScripts` is
  // `false`, which is also the default once chunk splitting is enabled, and
  // would externalize the background. A lazy bundle's background must always be
  // inlined and required synchronously regardless of `inlineScripts`.
  test('inlines lazy bundle background when inlineScripts is disabled', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    let appServiceJSContent = ''

    // Isolate the dist root so this build cannot race other tests in this
    // package writing to the default `test/dist/` directory.
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-lazy-inline-scripts-'),
    )

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: fileURLToPath(
              new URL(
                './fixtures/lazy-bundle/index.tsx',
                import.meta.url,
              ),
            ),
          },
        },
        output: {
          distPath: {
            root: tmp,
          },
          inlineScripts: false,
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
                name: 'capture-lazy-app-service',
                apply(compiler) {
                  compiler.hooks.compilation.tap(
                    'capture-lazy-app-service',
                    (compilation) => {
                      const hooks = LynxTemplatePlugin
                        .getLynxTemplatePluginHooks(
                          compilation as unknown as Parameters<
                            typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
                          >[0],
                        )
                      hooks.beforeEmit.tap(
                        'capture-lazy-app-service',
                        (args) => {
                          // The host card legitimately loads the lazy bundle via
                          // requireModuleAsync, so only inspect the dynamic
                          // component's own template.
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
                },
              } as Rspack.RspackPluginInstance,
            ],
          },
        },
      },
    })

    try {
      await rsbuild.build()

      // The lazy bundle's background is inlined and required synchronously.
      expect(appServiceJSContent).toContain('lynx.requireModule(')
      expect(appServiceJSContent).not.toContain('requireModuleAsync')

      // Execute the generated app-service to confirm the background is required
      // synchronously: a `requireModuleAsync` here would leave `module.exports`
      // empty, which is the runtime failure observed in production.
      const componentExports = { name: 'LazyComponent' }
      let requireModuleAsyncWasCalled = false
      const lynx = {
        requireModule: () => componentExports,
        requireModuleAsync: () => {
          requireModuleAsyncWasCalled = true
        },
      }
      // `globDynamicComponentEntry` is a global injected by the Lynx runtime and
      // referenced by the generated app-service.
      // @ts-expect-error injected runtime global
      globalThis.globDynamicComponentEntry = undefined
      // biome-ignore lint/suspicious/noExplicitAny: module factory cache
      const mod: Record<string, any> = {}
      const tt = {
        define: (key: string, fn: (...args: unknown[]) => void) => {
          mod[key] = fn
        },
        require: (key: string) => {
          const mockModule = { exports: {} as unknown }
          const args: unknown[] = Array(17).fill(undefined)
          args[1] = mockModule
          args[16] = lynx
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          mod[key](...args)
          return mockModule.exports
        },
      }

      const { init } = withLeakedCoverageCountersStubbed(
        appServiceJSContent,
        () =>
          eval(appServiceJSContent) as {
            init: (arg: { tt: typeof tt }) => unknown
          },
      )
      const result = init({ tt })

      expect(requireModuleAsyncWasCalled).toBe(false)
      expect(result).toBe(componentExports)
    } finally {
      // @ts-expect-error injected runtime global
      delete globalThis.globDynamicComponentEntry
      rstest.unstubAllEnvs()
    }
  })
})
