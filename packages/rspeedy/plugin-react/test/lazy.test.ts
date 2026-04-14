// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import vm from 'node:vm'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { afterAll, describe, expect, test, vi } from 'vitest'

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

async function collectJsAssets(
  rootDir: string,
  relativeDir = '.',
): Promise<Map<string, string>> {
  const dirPath = path.join(rootDir, relativeDir)
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const assets = new Map<string, string>()

  await Promise.all(entries.map(async (entry) => {
    const entryRelativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      const nestedAssets = await collectJsAssets(rootDir, entryRelativePath)
      for (const [file, source] of nestedAssets) {
        assets.set(file, source)
      }
      return
    }

    if (!entry.name.endsWith('.js')) {
      return
    }

    const source = await fs.readFile(
      path.join(rootDir, entryRelativePath),
      'utf8',
    )
    assets.set(path.normalize(entryRelativePath), source)
  }))

  return assets
}

async function readLepusChunkNames(tasmPath: string): Promise<string[]> {
  const source = await fs.readFile(tasmPath, 'utf8')
  const template = JSON.parse(source) as {
    lepusCode?: {
      lepusChunk?: Record<string, string>
    }
  }

  return Object.keys(template.lepusCode?.lepusChunk ?? {})
}

const sExportsReact = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react)')
const sExportsReactInternal = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/internal)',
)
const sExportsJSXRuntime = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-runtime)',
)
const sExportsJSXDevRuntime = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-dev-runtime)',
)
const tempDirs: string[] = []

afterAll(async () => {
  await Promise.all(tempDirs.map(async (dir) => {
    await fs.rm(dir, { recursive: true, force: true })
  }))
})

async function createIsolatedRspeedy(
  options: Parameters<typeof createRspeedy>[0],
): Promise<Awaited<ReturnType<typeof createRspeedy>>> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'rspeedy-react-lazy-'))
  tempDirs.push(root)

  return await createRspeedy({
    ...options,
    rspeedyConfig: {
      ...options.rspeedyConfig,
      output: {
        ...options.rspeedyConfig?.output,
        // These tests assert on emitted artifacts and run in a larger suite.
        // Use isolated output roots so parallel files cannot clean or overwrite
        // the shared test/dist directory out from under this case.
        distPath: {
          ...options.rspeedyConfig?.output?.distPath,
          root,
        },
      },
    },
  })
}

function evaluateStandaloneLazyMainThread(
  source: string,
) {
  const factory = vm.runInThisContext(source) as (
    globDynamicComponentEntry: string,
  ) => Record<string, unknown>

  return factory('__Card__')
}

function withFakeHostEnvironment<T>(run: () => T): T {
  const globalDescriptors = new Map<
    PropertyKey,
    PropertyDescriptor | undefined
  >()
  const globalsToRestore: PropertyKey[] = [
    '__DEV__',
    '__PROFILE__',
    '__ALOG__',
    '__JS__',
    '__LEPUS__',
    '__BACKGROUND__',
    '__MAIN_THREAD__',
    'lynx',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    // The generated host/lazy assets may touch timer globals while bootstrapping.
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'registerWorkletInternal',
    'registerWorklet',
    'runWorklet',
    'lynxWorkletImpl',
    '__LoadLepusChunk',
    'SystemInfo',
    sExportsReact,
    sExportsReactInternal,
    sExportsJSXRuntime,
    sExportsJSXDevRuntime,
  ]

  for (const key of globalsToRestore) {
    globalDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    )
  }

  Object.assign(globalThis, {
    __DEV__: true,
    __PROFILE__: true,
    __ALOG__: false,
    __JS__: false,
    __LEPUS__: true,
    __BACKGROUND__: false,
    __MAIN_THREAD__: true,
    lynx: {
      performance: {
        profileStart: vi.fn(),
        profileEnd: vi.fn(),
        profileMark: vi.fn(),
        profileFlowId: vi.fn(() => 1),
      },
      getNative: vi.fn(() => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      getNativeApp: vi.fn(() => ({
        callLepusMethod: vi.fn(),
        markTiming: vi.fn(),
      })),
      getJSContext: vi.fn(() => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      createSelectorQuery: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn(),
      })),
    },
    SystemInfo: {
      lynxSdkVersion: '2.16',
    },
    requestAnimationFrame: vi.fn(),
    cancelAnimationFrame: vi.fn(),
  })

  delete globalThis.registerWorkletInternal
  delete globalThis.registerWorklet
  delete globalThis.runWorklet
  delete globalThis.lynxWorkletImpl

  try {
    return run()
  } finally {
    for (const [key, descriptor] of globalDescriptors) {
      restoreGlobalDescriptor(key, descriptor)
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
      vi.stubEnv('NODE_ENV', mode)

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      let backgroundJSContent = ''

      const rsbuild = await createIsolatedRspeedy({
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

  test('standalone lazy bundle worklets should self-bootstrap without host fallback', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createIsolatedRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: new URL(
              './fixtures/standalone-lazy-bundle-worklet/index.tsx',
              import.meta.url,
            ).pathname,
          },
        },
        plugins: [
          pluginReactLynx({
            experimental_isLazyBundle: true,
          }),
        ],
      },
    })

    try {
      await rsbuild.build()
      const distRoot = rsbuild.context.distPath

      const jsAssets = await collectJsAssets(distRoot)
      const mainThreadAssets = [...jsAssets.entries()].filter(([name]) =>
        name.includes('main-thread')
      )
      const lepusChunkNames = await readLepusChunkNames(
        path.join(distRoot, '.rspeedy/main/tasm.json'),
      )

      expect(mainThreadAssets).toHaveLength(1)
      expect(jsAssets.has(path.normalize('.rspeedy/main/worklet-runtime.js')))
        .toBe(false)
      expect(lepusChunkNames).not.toContain('worklet-runtime')

      const [, source] = mainThreadAssets[0]!
      expect(source).toContain('globalThis.lynxWorkletImpl = {')
      expect(source).toContain('registerWorkletInternal("main-thread"')
      expect(source).not.toContain('__workletRuntimeLoaded')

      const hostRsbuild = await createIsolatedRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: new URL(
                './fixtures/mixed-version-host/index.ts',
                import.meta.url,
              ).pathname,
            },
          },
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      await hostRsbuild.build()
      const hostDistRoot = hostRsbuild.context.distPath

      const hostAssets = await collectJsAssets(hostDistRoot)
      const hostMainThreadAssets = [...hostAssets.entries()].filter(([name]) =>
        name.includes('main-thread')
      )
      expect(hostMainThreadAssets).toHaveLength(1)

      const [, hostSource] = hostMainThreadAssets[0]!

      withFakeHostEnvironment(() => {
        vm.runInThisContext(hostSource)

        const hostInternal = globalThis[sExportsReactInternal] as {
          loadWorkletRuntime: (...args: unknown[]) => unknown
        }
        expect(hostInternal).toBeDefined()

        const hostLoadWorkletRuntime = vi.fn(() => {
          throw new Error('new lazy bundle should not need host worklet chunk')
        })
        globalThis.__LoadLepusChunk = hostLoadWorkletRuntime

        const exports = evaluateStandaloneLazyMainThread(source)

        expect(exports).toHaveProperty('default')
        expect(hostLoadWorkletRuntime).not.toHaveBeenCalled()
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('lazy bundle beforeEncode entryNames', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const entryNamesOfBeforeEncode: string[][] = []
    let backgroundJSContent = ''

    const rsbuild = await createIsolatedRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: new URL(
              './fixtures/lazy-bundle/index.tsx',
              import.meta.url,
            ).pathname,
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

    try {
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
      const cssHotUpdateList =
        /\.cssHotUpdateList\s*=\s*(\[\[[\s\S]*?\]\])/.exec(
          backgroundJSContent,
        )![1]
      expect(cssHotUpdateList).toMatchInlineSnapshot(
        `"[["./LazyComponent.js-react__background",".rspeedy/async/./LazyComponent.js-react__background/./LazyComponent.js-react__background.css.hot-update.json"],["main",".rspeedy/main/main.css.hot-update.json"]]"`,
      )
    } finally {
      vi.unstubAllEnvs()
    }
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

    const rsbuild = await createIsolatedRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: new URL(
              './fixtures/lazy-bundle/index.tsx',
              import.meta.url,
            ).pathname,
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
      vi.unstubAllEnvs()
    }
  })
})
function restoreGlobalDescriptor(
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (!descriptor) {
    delete globalThis[key]
    return
  }

  Object.defineProperty(globalThis, key, descriptor)
}
