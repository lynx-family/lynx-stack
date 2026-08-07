// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

// biome-ignore lint/suspicious/noEmptyBlockStatements: the stubs are no-ops
const noop = (): void => {}

interface StubElement {
  tag: string
  id: number
  children: StubElement[]
  attributes: Record<string, unknown>
}

function createMainThreadEnv() {
  let nextId = 1
  const create = (tag: string): StubElement => ({
    tag,
    id: nextId++,
    children: [],
    attributes: {},
  })
  let page: StubElement | undefined

  const env: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    globDynamicComponentEntry: '__Card__',
    lynx: {
      __initData: {},
      getNativeApp: () => ({ callLepusMethod: noop }),
      reportError: (error: unknown) => {
        throw error
      },
      performance: {
        profileStart: noop,
        profileEnd: noop,
        profileMark: noop,
      },
      queueMicrotask: (fn: () => void) => void Promise.resolve().then(fn),
    },
    __CreatePage: () => (page = create('page')),
    __CreateView: () => create('view'),
    __CreateText: () => create('text'),
    __CreateImage: () => create('image'),
    __CreateRawText: () => create('raw-text'),
    __CreateElement: (tag: string) => create(tag),
    __CreateWrapperElement: () => create('wrapper'),
    __CreateScrollView: () => create('scroll-view'),
    __CreateList: () => create('list'),
    __AppendElement: (parent: StubElement, child: StubElement) =>
      parent.children.push(child),
    __InsertElementBefore: (parent: StubElement, child: StubElement) =>
      parent.children.push(child),
    __RemoveElement: (parent: StubElement, child: StubElement) => {
      parent.children = parent.children.filter(element => element !== child)
    },
    __SetAttribute: (
      element: StubElement,
      key: string,
      value: unknown,
    ) => (element.attributes[key] = value),
    __SetClasses: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['class'] = value),
    __SetInlineStyles: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['style'] = value),
    __SetID: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['id'] = value),
    __AddDataset: (
      element: StubElement,
      key: string,
      value: unknown,
    ) => (element.attributes[`data-${key}`] = value),
    __SetCSSId: noop,
    __AddEvent: noop,
    __SetEvents: noop,
    __FlushElementTree: noop,
    __GetPageElement: () => page,
    __GetElementUniqueID: (element: StubElement) => element.id,
    __GetTemplateParts: () => ({}),
    __ElementIsEqual: (a: StubElement, b: StubElement) => a === b,
    __OnLifecycleEvent: noop,
    _ReportError: (error: unknown) => {
      throw error
    },
  }
  env['globalThis'] = env

  return {
    env,
    getPage: () => page,
  }
}

describe('experimental_enableMTSRendering: false runtime', () => {
  test('the assembled bundle applies a patch that creates the real elements', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    let mainThread = ''
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-main-thread-runtime-'),
    )

    try {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          mode: 'production',
          source: {
            entry: {
              main: fileURLToPath(
                new URL(
                  './fixtures/mts-rendering-disabled.tsx',
                  import.meta.url,
                ),
              ),
            },
          },
          output: { distPath: { root: tmp } },
          plugins: [
            pluginReactLynx({ experimental_enableMTSRendering: false }),
            {
              name: 'ignore-css-loader-workaround',
              pre: ['lynx:react'],
              setup(api) {
                api.modifyBundlerChain((chain, { CHAIN_ID }) => {
                  const rule = chain.module
                    .rules.get('css:react:main-thread')
                    .uses.get(CHAIN_ID.USE.IGNORE_CSS)
                  rule.loader(rule.get('loader') as string + '.ts')
                })
              },
            } as RsbuildPlugin,
          ],
          tools: {
            rspack: {
              plugins: [
                {
                  name: 'collect-main-thread',
                  apply(compiler) {
                    compiler.hooks.compilation.tap(
                      'collect-main-thread',
                      (compilation) => {
                        compilation.hooks.processAssets.tap(
                          'collect-main-thread',
                          (assets) => {
                            for (const name in assets) {
                              if (name.endsWith('main-thread.js')) {
                                mainThread = assets[name]!.source().toString()
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

      const definitions = [
        ...new Set(mainThread.match(/__snapshot_[0-9a-f]+_[0-9a-f]+_\d+/g)),
      ]
      expect(definitions.length).toBeGreaterThan(0)

      const { env, getPage } = createMainThreadEnv()
      vm.createContext(env)
      vm.runInContext(mainThread, env, { filename: 'main-thread.js' })

      const renderPage = env['renderPage'] as (data: unknown) => void
      expect(renderPage).toBeTypeOf('function')

      renderPage({})
      expect(getPage()?.children).toHaveLength(0)

      const rLynxChange = env['rLynxChange'] as (args: {
        data: string
        patchOptions: { reloadVersion: number }
      }) => void
      const snapshotPatch: unknown[] = []
      definitions.forEach((definition, index) => {
        const id = index + 2
        snapshotPatch.push(0, definition, id, 1, -1, id, undefined)
      })
      rLynxChange({
        data: JSON.stringify({ patchList: [{ id: 1, snapshotPatch }] }),
        patchOptions: { reloadVersion: 0 },
      })

      expect(getPage()?.children).toHaveLength(definitions.length)
      expect(JSON.stringify(getPage())).toContain('view')
      expect(JSON.stringify(getPage())).toContain('text')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test('its worklets call into one live shared module instance', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    let mainThread = ''
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-main-thread-shared-runtime-'),
    )

    try {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          mode: 'production',
          source: {
            entry: {
              main: fileURLToPath(
                new URL(
                  './fixtures/mts-rendering-shared/index.tsx',
                  import.meta.url,
                ),
              ),
            },
          },
          output: { distPath: { root: tmp } },
          plugins: [
            pluginReactLynx({ experimental_enableMTSRendering: false }),
            {
              name: 'ignore-css-loader-workaround',
              pre: ['lynx:react'],
              setup(api) {
                api.modifyBundlerChain((chain, { CHAIN_ID }) => {
                  const rule = chain.module
                    .rules.get('css:react:main-thread')
                    .uses.get(CHAIN_ID.USE.IGNORE_CSS)
                  rule.loader(rule.get('loader') as string + '.ts')
                })
              },
            } as RsbuildPlugin,
          ],
          tools: {
            rspack: {
              plugins: [
                {
                  name: 'collect-main-thread',
                  apply(compiler) {
                    compiler.hooks.compilation.tap(
                      'collect-main-thread',
                      (compilation) => {
                        compilation.hooks.processAssets.tap(
                          'collect-main-thread',
                          (assets) => {
                            for (const name in assets) {
                              if (name.endsWith('main-thread.js')) {
                                mainThread = assets[name]!.source().toString()
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

      const workletIds = [
        ...mainThread.matchAll(
          /registerWorkletInternal\(\s*"main-thread"\s*,\s*"([^"]+)"/g,
        ),
      ].map(match => match[1]!)
      expect(workletIds).toHaveLength(2)
      const [bumpId, readId] = workletIds as [string, string]

      const { env } = createMainThreadEnv()
      Object.assign(env['lynx'] as Record<string, unknown>, {
        getJSContext: () => ({
          addEventListener: noop,
          removeEventListener: noop,
          dispatchEvent: noop,
        }),
        getCoreContext: () => ({
          addEventListener: noop,
          removeEventListener: noop,
          dispatchEvent: noop,
        }),
      })
      const require = createRequire(import.meta.url)
      const workletRuntime = await fs.readFile(
        require.resolve('@lynx-js/react/worklet-runtime'),
        'utf-8',
      )
      env['__LoadLepusChunk'] = (name: string): boolean => {
        if (name === 'worklet-runtime') {
          vm.runInContext(workletRuntime, env, {
            filename: 'worklet-runtime.js',
          })
          return true
        }
        return false
      }
      vm.createContext(env)
      vm.runInContext(mainThread, env, { filename: 'main-thread.js' })

      const runWorklet = env['runWorklet'] as (
        ctx: { _wkltId: string },
        params: unknown[],
      ) => unknown
      expect(runWorklet).toBeTypeOf('function')

      const attributes: Record<string, unknown> = {}
      const target = {
        setAttribute: (name: string, value: unknown) => {
          attributes[name] = value
        },
      }

      // The first worklet mutates the shared module's state...
      runWorklet({ _wkltId: bumpId }, [{ target, step: 2 }])
      expect(attributes['total']).toBe(2)
      runWorklet({ _wkltId: bumpId }, [{ target, step: 3 }])
      expect(attributes['total']).toBe(5)

      // ...and the second observes it: one live instance per thread.
      runWorklet({ _wkltId: readId }, [{ target, step: 0 }])
      expect(attributes['total']).toBe(5)
      expect(attributes['marker']).toBe('shared-module-marker')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
