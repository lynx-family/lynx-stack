// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild, loadConfig } from '@rsbuild/core'
import type { RsbuildConfig, RsbuildPlugin, Rspack } from '@rsbuild/core'
import { afterAll, describe, expect, test } from '@rstest/core'

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'
import type { TemplateHooks } from '@lynx-js/template-webpack-plugin'

import { pluginLynx } from '../src/index.js'

const vanillaExample = new URL('../../../../examples/vanilla/', import.meta.url)
const source = (name: string) =>
  fileURLToPath(new URL(`src/${name}`, vanillaExample))
const outputDirs: string[] = []

afterAll(async () => {
  await Promise.all(
    outputDirs.map(dir => rm(dir, { recursive: true, force: true })),
  )
})

describe('Vanilla source entries', () => {
  test('builds standalone Lynx and Web bundles in named environments', async () => {
    const nativeEnvironment = 'lynx-preview'
    const webEnvironment = 'web-preview'
    const output = await mkdtemp(path.join(tmpdir(), 'lynx-entries-'))
    outputDirs.push(output)
    const encoded: Parameters<
      Parameters<TemplateHooks['beforeEncode']['tap']>[1]
    >[0][] = []
    const observe: RsbuildPlugin = {
      name: 'test:observe-entries',
      setup(api) {
        api.modifyBundlerChain(chain => {
          chain.plugin('test:observe-entries').use({
            apply(compiler: Rspack.Compiler) {
              compiler.hooks.thisCompilation.tap(
                'test:observe-entries',
                compilation => {
                  LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation)
                    .beforeEncode.tap('test:observe-entries', args => {
                      encoded.push(args)
                      return args
                    })
                },
              )
            },
          })
        })
      },
    }
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        mode: 'production',
        environments: { [nativeEnvironment]: {}, [webEnvironment]: {} },
        splitChunks: false,
        source: {
          entry: {
            counter: 'counter-main',
            'counter.background': source('index.ts'),
          },
        },
        resolve: { alias: { 'counter-main': source('index.ts') } },
        output: { distPath: { root: output } },
        plugins: [pluginLynx(), observe],
      },
    })
    const configs = await rsbuild.initConfigs()
    for (const config of configs) {
      const isNative = config.name === nativeEnvironment
      expect(config.plugins?.map(plugin => plugin?.constructor.name))
        .toContain(isNative ? 'LynxEncodePlugin' : 'WebEncodePlugin')
      const wrappers = config.plugins?.filter(plugin =>
        plugin?.constructor.name === 'RuntimeWrapperWebpackPlugin'
      )
      expect(wrappers).toMatchObject(
        isNative
          ? [{
            options: {
              test: [
                '.lynx/counter/background.js',
                '.lynx/counter.background/background.js',
              ],
            },
          }]
          : [],
      )
    }
    await rsbuild.build()
    for (const platform of [nativeEnvironment, webEnvironment]) {
      for (const name of ['counter', 'counter.background']) {
        expect(existsSync(path.join(output, `${name}.${platform}.bundle`)))
          .toBe(true)
      }
    }
    expect(encoded).toHaveLength(4)
    for (const { encodeData } of encoded) {
      expect(encodeData.sourceContent.config).not.toHaveProperty(
        'enableEventHandleRefactor',
      )
      const main = encodeData.lepusCode.root?.name
      assert(main)
      expect(main).toMatch(/main-thread\.js$/)
      // Native encoding prefixes manifest paths with '/', Web keeps them relative.
      const manifest = Object.keys(encodeData.manifest).map(name =>
        name.replace(/^\//, '')
      )
      expect(manifest).toContain(
        path.posix.join(path.posix.dirname(main), 'background.js'),
      )
    }
  })

  test.each(['lynx', 'web'])(
    'compiles the single-entry Vanilla example for %s',
    async environment => {
      const cwd = fileURLToPath(vanillaExample)
      const { content } = await loadConfig({ cwd })
      const root = await mkdtemp(path.join(tmpdir(), 'lynx-entries-'))
      outputDirs.push(root)
      const output = path.join(root, 'dist')
      const preEntry = path.join(root, 'pre-entry.js')
      await writeFile(
        path.join(root, 'register.js'),
        'console.log("VANILLA_SIDE_EFFECT");',
      )
      await writeFile(
        preEntry,
        [
          'import "./register.js";',
          'if (__MAIN_THREAD__) console.log("MAIN_MACRO");',
          'if (__BACKGROUND__) console.log("BACKGROUND_MACRO");',
        ].join('\n'),
      )

      const rsbuild = await createRsbuild({
        cwd,
        environment: [environment],
        config: {
          ...content,
          mode: 'development',
          source: { ...content.source, preEntry },
          output: { distPath: { root: output } },
        },
      })
      await rsbuild.build()

      const template = await readFile(
        path.join(output, '.lynx/main/tasm.json'),
        'utf8',
      )
      const data = JSON.parse(template) as {
        lepusCode: { root: string }
        manifest: Record<string, string>
      }
      expect(data).toMatchObject({
        sourceContent: { config: { enableEventHandleRefactor: true } },
      })
      expect(data.lepusCode.root).toContain('__CreatePage')
      expect(data.lepusCode.root).not.toContain('getCoreContext')
      expect(data.lepusCode.root).toContain('MAIN_MACRO')
      expect(data.lepusCode.root).not.toContain('BACKGROUND_MACRO')
      const background = Object.values(data.manifest).join('\n')
      expect(data.lepusCode.root).toContain('VANILLA_SIDE_EFFECT')
      expect(background).toContain('VANILLA_SIDE_EFFECT')
      expect(background).toContain('getCoreContext')
      expect(background).not.toContain('__CreatePage')
      expect(background).toContain('BACKGROUND_MACRO')
      expect(background).not.toContain('MAIN_MACRO')
      expect(existsSync(path.join(output, '.lynx/main/main.css'))).toBe(true)
      expect(
        existsSync(
          path.join(output, '.lynx/main.background/main.background.css'),
        ),
      ).toBe(false)
      const { printUrls } = rsbuild.getNormalizedConfig().server
      assert(typeof printUrls === 'function')
      const urls = printUrls({
        port: 3000,
        urls: [],
        routes: [],
        protocol: 'http',
      })
      expect(urls).toHaveLength(environment === 'web' ? 2 : 1)
      expect(urls?.[0]).toHaveProperty(
        'url',
        expect.stringContaining(`/main.${environment}.bundle`),
      )
    },
  )

  test.each([
    { callerName: 'rstest', environment: 'lynx' },
    { callerName: 'rsbuild', environment: 'node' },
  ])('skips app assembly for $callerName in $environment', async ({
    callerName,
    environment,
  }) => {
    const rsbuild = await createRsbuild({
      callerName,
      rsbuildConfig: {
        environments: { [environment]: {} },
        source: { entry: { main: source('main-thread.ts') } },
        plugins: [pluginLynx()],
      },
    })
    const [config] = await rsbuild.initConfigs()
    expect(config?.plugins?.map(plugin => plugin?.constructor.name))
      .not.toContain('LynxTemplatePlugin')
  })

  test('leaves entries with DSL layers and their HMR configuration untouched', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        mode: 'development',
        source: {
          entry: {
            main: {
              import: source('main-thread.ts'),
              layer: 'custom:main-thread',
            },
          },
        },
        plugins: [pluginLynx()],
      },
    })
    const [config] = await rsbuild.initConfigs()
    expect(config?.entry).toMatchObject({
      main: { layer: 'custom:main-thread' },
    })
    const names = config?.plugins?.map(plugin => plugin?.constructor.name)
    expect(names).not.toContain('LynxTemplatePlugin')
    expect(names).toContain('HotModuleReplacementPlugin')
  })

  test('rejects Vanilla and DSL layers mixed in one environment', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            vanilla: source('main-thread.ts'),
            managed: {
              import: source('main-thread.ts'),
              layer: 'custom:main-thread',
            },
          },
        },
        plugins: [pluginLynx()],
      },
    })
    await expect(rsbuild.initConfigs()).rejects.toThrow(
      'Configure them in separate environments',
    )
  })

  test('keeps preEntry and environment-specific entry descriptions', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: { preEntry: './bootstrap.ts' },
        environments: {
          lynx: {
            source: {
              entry: {
                native: { import: source('main-thread.ts'), runtime: false },
              },
            },
          },
          web: { source: { entry: { browser: source('main-thread.ts') } } },
        },
        plugins: [pluginLynx()],
      },
    })
    const configs = await rsbuild.initConfigs()
    for (const config of configs) {
      const name = config.name === 'lynx' ? 'native' : 'browser'
      expect(Object.keys(config.entry ?? {})).toEqual([
        name,
        `${name}.background`,
      ])
      expect(config.entry).toMatchObject({
        [name]: {
          import: ['./bootstrap.ts', source('main-thread.ts')],
          layer: 'vanilla:main-thread',
          ...(config.name === 'lynx' ? { runtime: false } : {}),
        },
        [`${name}.background`]: {
          import: ['./bootstrap.ts', source('main-thread.ts')],
          layer: 'vanilla:background',
        },
      })
    }
  })

  test.each(['lynx', 'web'])(
    'rejects unsupported chunk layouts in %s',
    async environment => {
      const root = await mkdtemp(path.join(tmpdir(), 'lynx-chunk-boundary-'))
      outputDirs.push(root)
      await writeFile(
        path.join(root, 'async-main.js'),
        'if (__MAIN_THREAD__) import("./lazy.js").then(console.log)',
      )
      await writeFile(
        path.join(root, 'async-background.js'),
        'if (__BACKGROUND__) import("./lazy.js").then(console.log)',
      )
      await writeFile(path.join(root, 'lazy.js'), 'export const value = 42')
      const cases: RsbuildConfig[] = [
        {
          source: { entry: { main: source('main-thread.ts') } },
          tools: { rspack: { optimization: { runtimeChunk: 'single' } } },
        },
        {
          source: {
            entry: {
              shared: source('events.ts'),
              main: { import: source('main-thread.ts'), dependOn: 'shared' },
            },
          },
        },
        { source: { entry: { main: path.join(root, 'async-main.js') } } },
        { source: { entry: { main: path.join(root, 'async-background.js') } } },
      ]
      for (const config of cases) {
        const rsbuild = await createRsbuild({
          rsbuildConfig: {
            ...config,
            mode: 'production',
            environments: { [environment]: {} },
            output: { distPath: { root: path.join(root, 'dist') } },
            plugins: [pluginLynx()],
          },
        })
        await expect(rsbuild.build()).rejects.toThrow(
          'must emit a single JavaScript asset',
        )
      }
    },
  )
})
