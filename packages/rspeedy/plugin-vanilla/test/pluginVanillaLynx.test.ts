// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  RsbuildPlugin,
  RsbuildPluginAPI,
  Rspack,
  RspackChain,
} from '@rsbuild/core'
import { afterAll, describe, expect, test } from '@rstest/core'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import type { LynxConfig } from '@lynx-js/rsbuild-plugin'
import { createRspeedy } from '@lynx-js/rspeedy'

import * as vanilla from '../src/index.js'

// Built by `pluginLynx` itself, so the resolvers under test are the real ones
// rather than a stub that fabricates them.
function createLynxConfigStub(bundle?: string): LynxConfig {
  let config: LynxConfig | undefined

  // `pluginLynx` exposes the config from its second plugin, so the loop stops
  // there instead of setting up the rest of the engine.
  const options = bundle === undefined
    ? {}
    : { output: { filename: { bundle } } }

  for (const plugin of pluginLynx(options)) {
    // `pluginConfig.setup` is synchronous, so the config is set before the
    // check below.
    void plugin.setup({
      expose(_id: string | symbol, value: unknown) {
        config = value as LynxConfig
      },
    } as unknown as RsbuildPluginAPI)

    if (config) {
      break
    }
  }

  if (!config) {
    throw new Error('pluginLynx exposed no Lynx config')
  }

  return config
}

const tempDirs: string[] = []

interface EntryPointStub {
  values(): unknown[]
}

interface PluginUse {
  args?: unknown[] | undefined
  plugin: unknown
}

interface HarnessOptions {
  environment?: string | undefined
  lynxConfigTarget?: string | undefined
  pluginOptions?: vanilla.PluginVanillaLynxOptions | undefined
  rawEntries?: Record<string, EntryPointStub> | undefined
  lynxBundleFilename?: string | undefined
}

interface HarnessResult {
  clearedEntries: boolean
  entries: Map<string, unknown>
  exposed: Map<string | symbol, unknown>
  plugins: Map<string, PluginUse>
}

type BundlerChainModifier = (
  chain: RspackChain,
  context: { environment: { name: string } },
) => void | Promise<void>

function fixturePath(name: string): string {
  return fileURLToPath(new URL(`./fixtures/basic/${name}`, import.meta.url))
}

async function runPluginHarness(
  options: HarnessOptions = {},
): Promise<HarnessResult> {
  const exposed = new Map<string | symbol, unknown>()
  if (options.lynxConfigTarget) {
    exposed.set(Symbol.for('lynx.config'), {
      config: { targetSdkVersion: options.lynxConfigTarget },
    })
  }
  // A real Lynx build always has the engine applied, so the config is always
  // exposed here too.
  exposed.set(
    Symbol.for('@lynx-js/rsbuild-plugin:config'),
    createLynxConfigStub(options.lynxBundleFilename),
  )

  let bundlerChainModifier: BundlerChainModifier | undefined
  const api = {
    context: { rootPath: process.cwd() },
    expose(id: string | symbol, value: unknown) {
      exposed.set(id, value)
    },
    modifyBundlerChain(handler: unknown) {
      bundlerChainModifier = handler as BundlerChainModifier
    },
    modifyRsbuildConfig() {
      // The unit harness only exercises the bundler-chain hook.
    },
    useExposed(id: string | symbol) {
      return exposed.get(id)
    },
  } as unknown as RsbuildPluginAPI

  const plugin = vanilla.pluginVanillaLynx(options.pluginOptions)
  await plugin.setup(api)

  if (!bundlerChainModifier) {
    throw new Error('pluginVanillaLynx did not register modifyBundlerChain')
  }

  const entries = new Map<string, unknown>()
  const plugins = new Map<string, PluginUse>()
  let clearedEntries = false
  const chain = {
    entry(name: string) {
      return {
        add(value: unknown) {
          entries.set(name, value)
        },
      }
    },
    entryPoints: {
      clear() {
        clearedEntries = true
      },
      entries() {
        return options.rawEntries
      },
    },
    plugin(name: string) {
      return {
        use(pluginConstructorOrInstance: unknown, args?: unknown[]) {
          plugins.set(name, {
            args,
            plugin: pluginConstructorOrInstance,
          })
        },
      }
    },
  } as unknown as RspackChain

  await bundlerChainModifier(chain, {
    environment: { name: options.environment ?? 'lynx' },
  })

  return { clearedEntries, entries, exposed, plugins }
}

function getTemplateOptions(
  result: HarnessResult,
  entryName: string,
): Record<string, unknown> {
  const options = result.plugins.get(
    `lynx:vanilla:template:${entryName}`,
  )?.args?.[0]
  if (typeof options !== 'object' || options === null) {
    throw new Error(`Missing template options for entry ${entryName}`)
  }
  return options as Record<string, unknown>
}

function getVanillaWebpackPlugin(
  result: HarnessResult,
): Rspack.RspackPluginInstance {
  const plugin = result.plugins.get('VanillaLynxWebpackPlugin')?.plugin
  if (typeof plugin !== 'object' || plugin === null || !('apply' in plugin)) {
    throw new Error('Missing VanillaLynxWebpackPlugin')
  }
  return plugin as Rspack.RspackPluginInstance
}

afterAll(async () => {
  await Promise.all(tempDirs.map(async dir => {
    await rm(dir, { force: true, recursive: true })
  }))
})

describe('pluginVanillaLynx', () => {
  test('builds main-thread, background, CSS, and template assets', async () => {
    const outputRoot = await mkdtemp(
      path.join(tmpdir(), 'rspeedy-vanilla-test-'),
    )
    tempDirs.push(outputRoot)

    let beforeEncodeArgs:
      | Parameters<
        Parameters<vanilla.TemplateHooks['beforeEncode']['tap']>[1]
      >[0]
      | undefined

    const observeTemplate: RsbuildPlugin = {
      name: 'test:observe-vanilla-template',
      setup(api) {
        api.modifyBundlerChain(chain => {
          const exposed = api.useExposed<{
            LynxTemplatePlugin: vanilla.LynxTemplatePlugin
          }>(Symbol.for('LynxTemplatePlugin'))
          const plugin: Rspack.RspackPluginInstance = {
            apply(compiler) {
              compiler.hooks.thisCompilation.tap(
                'test:observe-vanilla-template',
                compilation => {
                  const hooks = exposed!.LynxTemplatePlugin
                    .getLynxTemplatePluginHooks(compilation)
                  hooks.beforeEncode.tap(
                    'test:observe-vanilla-template',
                    args => {
                      beforeEncodeArgs = args
                      return args
                    },
                  )
                },
              )
            },
          }
          chain.plugin('test:observe-vanilla-template').use(plugin)
        })
      },
    }

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        output: {
          distPath: { root: outputRoot },
          filename: '[name].bundle',
        },
        plugins: [
          vanilla.pluginVanillaLynx({
            entries: {
              card: {
                mainThread: fileURLToPath(
                  new URL(
                    './fixtures/basic/main-thread.ts',
                    import.meta.url,
                  ),
                ),
              },
            },
          }),
          observeTemplate,
        ],
      },
    })

    await rspeedy.build()

    expect(existsSync(path.join(outputRoot, 'card.bundle'))).toBe(true)
    expect(beforeEncodeArgs?.encodeData.lepusCode.root?.name).toBe(
      '.rspeedy/card/main-thread.js',
    )
    expect(
      beforeEncodeArgs?.encodeData.lepusCode.root?.source.source().toString(),
    ).toContain('__vanillaMainThreadLoaded')
    expect(Object.keys(beforeEncodeArgs?.encodeData.manifest ?? {})).toEqual([
      '/app-service.js',
      '/.rspeedy/card/background.js',
    ])
    expect(beforeEncodeArgs?.encodeData.compilerOptions).toMatchObject({
      targetSdkVersion: '3.5',
    })
    expect(beforeEncodeArgs?.encodeData.sourceContent.config).toMatchObject({
      enableEventHandleRefactor: true,
    })
  })

  test('builds web and lynx bundles with platform-specific encoders', async () => {
    const outputRoot = await mkdtemp(
      path.join(tmpdir(), 'rspeedy-vanilla-platforms-test-'),
    )
    tempDirs.push(outputRoot)

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        environments: {
          web: {},
          lynx: {},
        },
        output: {
          distPath: { root: outputRoot },
        },
        plugins: [vanilla.pluginVanillaLynx()],
        source: {
          entry: fixturePath('main-thread.ts'),
        },
      },
    })

    const [webConfig, lynxConfig] = await rspeedy.initConfigs()

    expect(
      webConfig?.plugins?.some(plugin =>
        plugin?.constructor.name === 'WebEncodePlugin'
      ),
    ).toBe(true)
    expect(
      webConfig?.plugins?.some(plugin =>
        plugin?.constructor.name === 'RuntimeWrapperWebpackPlugin'
      ),
    ).toBe(false)
    expect(
      lynxConfig?.plugins?.some(plugin =>
        plugin?.constructor.name === 'LynxEncodePlugin'
      ),
    ).toBe(true)
    expect(
      lynxConfig?.plugins?.some(plugin =>
        plugin?.constructor.name === 'RuntimeWrapperWebpackPlugin'
      ),
    ).toBe(true)

    await rspeedy.build()

    expect(existsSync(path.join(outputRoot, 'main.web.bundle'))).toBe(true)
    expect(existsSync(path.join(outputRoot, 'main.lynx.bundle'))).toBe(true)
  })

  test('exposes Vanilla Lynx layers', async () => {
    let exposedLayers: typeof vanilla.LAYERS | undefined
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          vanilla.pluginVanillaLynx(),
          {
            name: 'test:read-vanilla-layers',
            setup(api) {
              api.modifyRsbuildConfig(config => {
                exposedLayers = api.useExposed<typeof vanilla.LAYERS>(
                  Symbol.for('LAYERS'),
                )
                return config
              })
            },
          } satisfies RsbuildPlugin,
        ],
        source: {
          entry: fileURLToPath(
            new URL('./fixtures/basic/main-thread.ts', import.meta.url),
          ),
        },
      },
    })

    await rspeedy.initConfigs()

    expect(exposedLayers).toEqual({
      BACKGROUND: 'vanilla:background',
      MAIN_THREAD: 'vanilla:main-thread',
    })
  })

  test('delegates explicit entry requests to Rspeedy resolution', async () => {
    const outputRoot = await mkdtemp(
      path.join(tmpdir(), 'rspeedy-vanilla-resolve-test-'),
    )
    tempDirs.push(outputRoot)

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        output: {
          distPath: { root: outputRoot },
          filename: '[name].bundle',
        },
        plugins: [
          vanilla.pluginVanillaLynx({
            entries: {
              card: {
                background: 'vanilla-background',
                css: 'vanilla-style',
                mainThread: 'vanilla-main-thread',
              },
            },
          }),
        ],
        resolve: {
          alias: {
            'vanilla-background$': fixturePath('background.ts'),
            'vanilla-main-thread$': fixturePath('main-thread.ts'),
            'vanilla-style$': fixturePath('style.css'),
          },
        },
      },
    })

    await rspeedy.build()

    expect(existsSync(path.join(outputRoot, 'card.bundle'))).toBe(true)
  })
})

describe('pluginVanillaLynx configuration', () => {
  test('normalizes heterogeneous Rsbuild entry values', async () => {
    const mainThreadRequest = `${
      path.relative(
        process.cwd(),
        fixturePath('main-thread.ts'),
      )
    }?raw`
    const result = await runPluginHarness({
      environment: 'web-preview',
      rawEntries: {
        card: {
          values: () => [
            42,
            null,
            { ignored: true },
            ['setup.ts', false, mainThreadRequest],
            { import: 'object-entry.ts' },
            { import: ['array-entry.ts', false] },
          ],
        },
      },
    })

    expect(result.entries.get('card__background')).toEqual({
      filename: '.rspeedy/card/background.js',
      import: fixturePath('background.ts'),
      layer: vanilla.LAYERS.BACKGROUND,
    })
    expect(result.entries.get('card__main-thread')).toEqual({
      filename: '.rspeedy/card/main-thread.js',
      import: [
        'setup.ts',
        mainThreadRequest,
        'object-entry.ts',
        'array-entry.ts',
        fixturePath('style.css'),
      ],
      layer: vanilla.LAYERS.MAIN_THREAD,
    })
    expect(getTemplateOptions(result, 'card')).toMatchObject({
      chunks: ['card__background', 'card__main-thread'],
      filename: 'card.web-preview.bundle',
    })
    expect(result.plugins.has('WebEncodePlugin')).toBe(true)
    expect(result.plugins.has('lynx:vanilla:runtime-wrapper')).toBe(false)
  })

  test('supports main-thread-only entries and option functions', async () => {
    let filenameContext: unknown
    const result = await runPluginHarness({
      environment: 'lynx-preview',
      lynxConfigTarget: '3.8',
      pluginOptions: {
        bundleFilename(context) {
          filenameContext = context
          return '[name].[platform].custom.bundle'
        },
        engineVersion: '4.0',
        entries: {
          card: {
            background: false,
            css: false,
            mainThread: '?raw',
          },
        },
        targetSdkVersion: '3.9',
      },
      lynxBundleFilename: '[name].ignored.bundle',
    })

    expect(filenameContext).toEqual({
      entryName: 'card',
      lazyBundle: false,
      platform: 'lynx-preview',
    })
    expect(result.entries.has('card__background')).toBe(false)
    expect(result.entries.get('card__main-thread')).toEqual({
      filename: '.rspeedy/card/main-thread.js',
      import: ['?raw'],
      layer: vanilla.LAYERS.MAIN_THREAD,
    })
    expect(getTemplateOptions(result, 'card')).toMatchObject({
      chunks: ['card__main-thread'],
      filename: 'card.lynx-preview.custom.bundle',
      targetSdkVersion: '4.0',
    })
    expect(result.plugins.has('lynx:vanilla:runtime-wrapper')).toBe(false)
    expect(result.plugins.has('LynxEncodePlugin')).toBe(true)
  })

  test('resolves target SDK and Rspeedy filename fallbacks', async () => {
    const scenarios: Array<{
      expectedFilename: string
      expectedTarget: string
      lynxConfigTarget?: string | undefined
      pluginOptions?: vanilla.PluginVanillaLynxOptions | undefined
      lynxBundleFilename?: HarnessOptions['lynxBundleFilename']
    }> = [
      {
        expectedFilename: 'main.template.bundle',
        expectedTarget: '3.9',
        lynxConfigTarget: '3.8',
        pluginOptions: { targetSdkVersion: '3.9' },
        lynxBundleFilename: '[name].template.bundle',
      },
      {
        expectedFilename: 'main.bundle-only',
        expectedTarget: '3.8',
        lynxConfigTarget: '3.8',
        lynxBundleFilename: '[name].bundle-only',
      },
      {
        expectedFilename: 'main.lynx.bundle',
        expectedTarget: '3.5',
      },
    ]

    for (const scenario of scenarios) {
      const result = await runPluginHarness({
        lynxConfigTarget: scenario.lynxConfigTarget,
        pluginOptions: scenario.pluginOptions,
        rawEntries: {
          main: { values: () => ['virtual-main-thread'] },
        },
        lynxBundleFilename: scenario.lynxBundleFilename,
      })

      expect(getTemplateOptions(result, 'main')).toMatchObject({
        filename: scenario.expectedFilename,
        targetSdkVersion: scenario.expectedTarget,
      })
    }
  })

  test('ignores unsupported environments and accepts an empty entry map', async () => {
    const unsupported = await runPluginHarness({
      environment: 'node',
    })
    expect(unsupported.clearedEntries).toBe(false)
    expect(unsupported.plugins.size).toBe(0)

    const empty = await runPluginHarness({
      environment: 'lynx-custom',
    })
    expect(empty.clearedEntries).toBe(true)
    expect(empty.entries.size).toBe(0)
    expect(empty.plugins.has('VanillaLynxWebpackPlugin')).toBe(true)
    expect(empty.plugins.has('LynxEncodePlugin')).toBe(true)
  })

  test('rejects an ambiguous Rsbuild entry', async () => {
    await expect(runPluginHarness({
      rawEntries: {
        ambiguous: {
          values: () => [
            'first.ts',
            'second.ts',
            { import: 42 },
          ],
        },
      },
    })).rejects.toThrow(
      '[pluginVanillaLynx] Entry `ambiguous` must contain exactly one `main-thread.ts` source.',
    )
  })

  test('reports a missing main-thread asset', async () => {
    const result = await runPluginHarness({
      rawEntries: {
        main: { values: () => ['virtual-main-thread'] },
      },
    })
    const plugin = getVanillaWebpackPlugin(result)
    const compilation = {
      getAsset() {
        return undefined
      },
      hooks: {
        processAssets: {
          tap(_options: unknown, handler: () => void) {
            handler()
          },
        },
      },
    }
    const compiler = {
      hooks: {
        thisCompilation: {
          tap(_name: string, handler: (compilation: unknown) => void) {
            handler(compilation)
          },
        },
      },
      webpack: {
        Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: 0 },
      },
    } as unknown as Rspack.Compiler

    expect(() => plugin.apply(compiler)).toThrow(
      '[pluginVanillaLynx] Main-thread asset was not emitted: .rspeedy/main/main-thread.js',
    )
  })
})
